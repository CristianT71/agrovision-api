"""Comparación de estadísticos de vuelos; no corresponde a diferencias por píxel."""
from datetime import datetime
import math

INDICES = ('NDVI', 'NDRE', 'GNDVI')
AVISO = ('Las capturas analizadas no son las mismas ni cubren exactamente la misma superficie; '
         'la comparación es entre estadísticos de cada vuelo, no pixel a pixel.')
CAUSAS = 'La comparación describe cambios en los índices, no causas'


def numero(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)


def diferencia(a, b):
    return b - a if numero(a) and numero(b) else None


def solape_huellas(a, b):
    """Intersección / caja menor en coordenadas locales; cajas degeneradas son desconocidas."""
    for caja in (a, b):
        if not isinstance(caja, dict) or not all(numero(caja.get(k)) for k in ('latMin', 'latMax', 'lonMin', 'lonMax')):
            return None
        if not (-90 <= caja['latMin'] < caja['latMax'] <= 90 and -180 <= caja['lonMin'] < caja['lonMax'] <= 180):
            return None
    area = lambda c: (c['latMax']-c['latMin'])*(c['lonMax']-c['lonMin'])
    inter = max(0, min(a['latMax'], b['latMax'])-max(a['latMin'], b['latMin']))
    inter *= max(0, min(a['lonMax'], b['lonMax'])-max(a['lonMin'], b['lonMin']))
    return inter/min(area(a), area(b))


def _fecha(v):
    try:
        return datetime.fromisoformat(v.replace('Z', '+00:00'))
    except (AttributeError, TypeError, ValueError):
        return None


def comparar_analisis(a, b, parametros=None):
    """Cambio = b − a. Ruido mínimo externo, nunca estimado de estos dos vuelos."""
    parametros = parametros or {}
    minimo = parametros.get('solapeMinimo', .5)
    ruido = parametros.get('ruidoMinimo')
    if not numero(minimo) or not 0 <= minimo <= 1:
        raise ValueError('solapeMinimo debe estar entre 0 y 1.')
    if ruido is not None and (not numero(ruido) or ruido < 0):
        raise ValueError('ruidoMinimo debe ser finito y no negativo.')
    aa, bb = a.get('analisis') or {}, b.get('analisis') or {}
    fa, fb = aa.get('ficha') or {}, bb.get('ficha') or {}
    motivos, avisos = [], []
    solape = solape_huellas(a.get('huella'), b.get('huella'))
    for etiqueta, vuelo in (('A', a), ('B', b)):
        if solape_huellas(vuelo.get('huella'), vuelo.get('huella')) is None:
            motivos.append(f'Falta una huella válida del vuelo {etiqueta}.')
    if solape is not None and solape < minimo:
        motivos.append('El solape de huellas es menor que el mínimo requerido (provisional).')
    # Se exige evidencia de capturas cenitales en cada vuelo: uno oblicuo no permite comparar.
    for etiqueta, f in (('A', fa), ('B', fb)):
        n = (f.get('georreferenciacion') or {}).get('capturasGeorreferenciables')
        if not numero(n) or n <= 0:
            motivos.append(f'El vuelo {etiqueta} no tiene capturas cenitales/georreferenciables confirmadas.')
    ia, ib = ({i['nombre']: i for i in r.get('indices', []) if i.get('nombre') in INDICES} for r in (aa, bb))
    if not ia.keys() & ib.keys():
        motivos.append('Falta un índice común entre los vuelos.')
    ca, cb = ((f.get('calibracion') or {}).get('sinCalibrar') for f in (fa, fb))
    if numero(ca) and numero(cb) and (ca > 0 or cb > 0):
        avisos.append('Calibración distinta o incompleta: hay capturas sin calibrar; los valores crudos no son comparables con los calibrados.')
    ga, gb = ((f.get('gsdCmPx') or {}).get('media') for f in (fa, fb))
    if numero(ga) and numero(gb) and min(ga, gb) > 0 and max(ga, gb)/min(ga, gb) > 1.3:
        avisos.append('El GSD medio difiere más de un 30 %; la comparación mezcla resoluciones.')
    if fa.get('alturaRelativaM') is not None and fb.get('alturaRelativaM') is not None and fa['alturaRelativaM'] != fb['alturaRelativaM']:
        avisos.append('Hay diferencia de altura relativa entre los vuelos.')
    na, nb = aa.get('capturasUsadas'), bb.get('capturasUsadas')
    if numero(na) and numero(nb) and na != nb:
        avisos.append('Muestreo distinto: cambia el número de capturas analizadas.')
    da, db = _fecha(a.get('fecha')), _fecha(b.get('fecha'))
    intervalo = None
    if da is None or db is None or (da.tzinfo is None) != (db.tzinfo is None):
        avisos.append('Fechas ausentes, inválidas o con zonas horarias incompatibles: no se puede calcular el intervalo.')
    else:
        intervalo = (db-da).total_seconds()/86400
        if da.date() == db.date():
            avisos.append('Ambas fechas son del mismo día: puede usarse como prueba nula (cambio esperado cero).')
        if intervalo < 0:
            avisos.append('La fecha B es anterior a A; el cambio sigue siendo B menos A.')
    avisos.append(AVISO)
    r = dict(comparable=not motivos, motivos=motivos, advertencias=avisos, intervaloDias=intervalo,
             solapeHuellas=solape, indices=None, vigor=None, cobertura=None, zonasCandidatas=None,
             plantas={'deltaDensidadPlantasHa': None, 'nota': 'estimación experimental sin validar'},
             lecturaSugerida=[])
    if not motivos:
        r['indices'] = {}
        for nombre in INDICES:
            x, y = ia.get(nombre, {}), ib.get(nombre, {})
            delta = diferencia(x.get('media'), y.get('media'))
            r['indices'][nombre] = dict(a={k: x.get(k) for k in ('media', 'mediana')},
                b={k: y.get(k) for k in ('media', 'mediana')}, deltaMedia=delta,
                deltaMediana=diferencia(x.get('mediana'), y.get('mediana')),
                deltaAreaBajoUmbralPct=diferencia(x.get('areaBajoUmbralPct'), y.get('areaBajoUmbralPct')),
                significativo=abs(delta) > ruido if delta is not None and ruido is not None else None)
            if delta is not None:
                cambio = ('subió' if delta > 0 else 'bajó') + ' ' + f'{abs(delta):.2f}'.replace('.', ',') if delta else 'no cambió'
                r['lecturaSugerida'].append(f'El {nombre} medio {cambio} entre los vuelos; la causa debe confirmarse en campo.')
        r['vigor'] = {k: diferencia((aa.get('vigor') or {}).get(k), (bb.get('vigor') or {}).get(k)) for k in ('bajoPct', 'medioPct', 'altoPct')}
        r['cobertura'] = diferencia((aa.get('cobertura') or {}).get('pct'), (bb.get('cobertura') or {}).get('pct'))
        za, zb = (len(v['zonasCandidatas']) if isinstance(v.get('zonasCandidatas'), list) else None for v in (aa, bb))
        r['zonasCandidatas'] = dict(a=za, b=zb, delta=diferencia(za, zb))
        r['plantas']['deltaDensidadPlantasHa'] = diferencia((aa.get('plantas') or {}).get('densidadMediaPlantasHa'), (bb.get('plantas') or {}).get('densidadMediaPlantasHa'))
    r['lecturaSugerida'].append(CAUSAS)
    return r
