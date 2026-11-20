"""Respaldo de los reportes de la app (celular) con lo que ve el dron.

Para cada reporte con coordenadas se toma un ENTORNO circular de unas 30 plantas (radio configurable) en la captura
cenital que lo contiene y se compara con el resto de esa misma captura (misma luz, misma calibración):
- NDVI, NDRE y GNDVI de la vegetación del entorno frente a ventanas del mismo tamaño repartidas por la captura
  (desviación robusta z y percentil);
- copas detectadas en NIR: densidad relativa y proporción de copas con NDRE bajo (agrupamiento frente al resto).

El dron NUNCA identifica la plaga: el veredicto solo dice si la vegetación del entorno es coherente o no con lo
reportado. Una caída de NDRE o GNDVI también puede deberse a nutrición, sequía, sombra o suelo descubierto.
Todos los cortes son provisionales: no están calibrados con observaciones de campo.
"""
from __future__ import annotations

import math
import re

import numpy as np

from . import calculo, copas, geo

PARAMETROS = dict(
    plantasEntorno=30,          # plantas del entorno; con el marco de siembra da el radio
    areaPlantaPorDefectoM2=2.0,  # sin marco de siembra: 2 m² por planta (2 m × 1 m), supuesto
    resolucionTrabajoM=0.05,    # se promedian bloques de píxeles hasta ~5 cm para comparar ventanas
    umbralVegetacion=0.4,       # NDVI mínimo de un píxel de vegetación (el mismo de las copas)
    minPixelesNativos=2000,     # menos píxeles de cámara en el entorno: muy pocos para comparar
    minPixelesVegetacion=200,   # píxeles de trabajo con vegetación en el entorno o en una ventana
    fraccionDentroMin=0.7,      # parte del círculo que debe caer dentro de la imagen
    minVentanas=8,              # ventanas del resto de la captura para tener con qué comparar
    zBaja=-1.0, zNormal=-0.5,   # cortes de la desviación robusta (provisionales)
    enriquecimientoMin=1.5,     # copas con NDRE bajo: veces más frecuentes en el entorno que en el resto
    minCopasEntorno=5,
    percentilCopaAnomala=20,
    maxDiasDiferencia=30,
    maxCapturas=6,
    maxGruposListados=6,
    escalaMinima=0.005,
)

INDICES = ('NDVI', 'NDRE', 'GNDVI')

ALIAS = {
    'roya': 'roya', 'leaf_rust': 'roya', 'rust': 'roya', 'roya_del_cafe': 'roya',
    'cercospora': 'cercospora', 'cerscospora': 'cercospora', 'mancha_de_hierro': 'cercospora',
    'phoma': 'phoma', 'antracnosis': 'antracnosis', 'anthracnose': 'antracnosis',
    'minador': 'minador', 'miner': 'minador', 'leaf_miner': 'minador',
    'hormigas': 'hormigas', 'sana': 'sana', 'sano': 'sana', 'healthy': 'sana',
}
# Qué esperar en el dosel. Criterio general, no una firma propia de cada plaga: una afección foliar extensa
# (clorosis, lesiones, defoliación) tiende a bajar NDRE y GNDVI frente al resto del lote; una planta sana, no.
FIRMAS = {'roya': 'baja', 'cercospora': 'baja', 'phoma': 'baja', 'antracnosis': 'baja', 'minador': 'baja',
          'deficiencia': 'baja', 'sana': 'normal'}
FIRMA_TEXTO = ('Criterio general, sin calibrar: una afección foliar extensa (clorosis, lesiones o defoliación) tiende a '
               'bajar el NDRE y el GNDVI del dosel frente al resto del lote; un reporte de planta sana espera lo contrario. '
               'No es una firma espectral propia de la plaga.')

MOTIVOS = {
    'sin_coordenadas': 'reporte sin coordenadas',
    'fecha_lejana': 'reporte muy lejano en el tiempo del vuelo',
    'fuera_capturas': 'fuera de las capturas cenitales del vuelo',
    'captura_inclinada': 'solo hay capturas inclinadas en ese punto',
    'gsd_supuesto': 'GSD supuesto (sin focal calibrada): la posición en la imagen no es fiable',
    'sin_bandas': 'la captura no tiene las 4 bandas (sin NIR u otra)',
    'error_lectura': 'no se pudo leer la captura',
    'limite_capturas': 'límite de capturas procesadas',
    'borde': 'el entorno queda cortado por el borde de la imagen',
    'pocos_pixeles': 'muy pocos píxeles o poca vegetación en el entorno',
    'pocas_ventanas': 'la captura es pequeña: pocas zonas con qué comparar',
    'sin_firma': 'la clase no tiene una alteración esperada visible desde el dron',
    'senal_intermedia': 'señal intermedia: ni claramente alterada ni normal',
}

AVISO_PENDIENTE = ('Diagnóstico fitosanitario pendiente: lo hacen el modelo del celular y un agrónomo en campo; el dron solo '
                   'aporta evidencia indirecta (vigor del dosel) y nunca confirma ni identifica la plaga.')
AVISO_PROPAGACION = 'No es posible calcular la propagación con un único vuelo: se necesitan vuelos repetidos sobre la misma zona.'
AVISOS = [
    AVISO_PENDIENTE,
    AVISO_PROPAGACION,
    'Una caída de NDRE o GNDVI también puede deberse a nutrición, sequía, sombra, suelo descubierto, edad o variedad: '
    '«coherente» no significa confirmado y «no coherente» no significa que el reporte sea falso (una roya incipiente '
    'o en el envés de la hoja puede no verse desde el aire).',
    'El GPS del celular suele errar de 3 a 10 m, comparable al radio del entorno; las posiciones en la imagen suponen '
    'terreno plano y cámara vertical.',
]


# Resolución del agrónomo en la solicitud (TIPOS_RESULTADO de la API) → conclusión sobre la hipótesis del celular
CONCLUSIONES = {'Confirma diagnóstico IA': 'confirmada', 'Corrige diagnóstico IA': 'otra_causa',
                'Plaga nueva': 'otra_causa', 'Planta sana': 'descartada',
                'Imagen no diagnosticable': 'no_diagnosticable'}


def estado_fitosanitario(revision):
    """hipotesis_sin_verificar (por defecto) o verificado_por_agronomo si la solicitud ligada está Resuelta."""
    r = revision or {}
    if r.get('estadoSolicitud') == 'Resuelta' and r.get('tipoResultado'):
        return dict(estado='verificado_por_agronomo', conclusion=CONCLUSIONES.get(r['tipoResultado'], 'otra_causa'),
                    tipoResultado=r['tipoResultado'], plagaIdentificada=r.get('plagaIdentificada'),
                    agronomo=r.get('agronomo'), fecha=(r.get('fechaResolucion') or '')[:10] or None)
    return dict(estado='hipotesis_sin_verificar', solicitud=r.get('estadoSolicitud') or 'sin solicitud al agrónomo')


def tipo_de_clase(clase):
    """Nombre de la clase de la app ('Leaf rust', 'Enfermedad_Roya', 'Cerscospora'...) → tipo de las reglas de zona."""
    if not isinstance(clase, str) or not clase.strip():
        return None
    n = re.sub(r'[\s\-]+', '_', clase.strip().lower())
    if n.startswith('deficiencia'):
        return 'deficiencia'
    n = re.sub(r'^(enfermedad|plaga)_', '', n)
    return ALIAS.get(n, n)


def radio_entorno(siembra=None, radio_m=None, plantas=None):
    """Radio del círculo con `plantas` plantas según el marco de siembra; o el radio configurado."""
    plantas = plantas or PARAMETROS['plantasEntorno']
    if radio_m:
        return float(radio_m), f'radio configurado de {radio_m:g} m'
    if siembra:
        area = siembra['distSurcoM'] * siembra['distPlantaM']
        origen = (f"{plantas} plantas con el marco de siembra {siembra['distSurcoM']:g} × {siembra['distPlantaM']:g} m"
                  + (' (provisional)' if siembra.get('provisional', True) else ''))
    else:
        area = PARAMETROS['areaPlantaPorDefectoM2']
        origen = f'{plantas} plantas a {area:g} m² por planta (supuesto, sin marco de siembra)'
    return math.sqrt(plantas * area / math.pi), origen


def _distancia_m(lat1, lon1, lat2, lon2):
    dy = (lat2 - lat1) * 111320
    dx = (lon2 - lon1) * 111320 * math.cos(math.radians((lat1 + lat2) / 2))
    return math.hypot(dx, dy)


def ubicar(lat, lon, capturas):
    """Elige la captura cenital donde el punto queda más lejos del borde. Devuelve (captura, x, y) o (motivo, dato)."""
    mejores = []
    for c in capturas:
        g = c.get('geo') or {}
        if not g.get('georreferenciable') or not c.get('gsd'):
            continue
        px = geo.latlon_a_pixel(g, lat, lon, c['gsd'])
        if px is None:
            continue
        x, y = px
        ancho, alto = c.get('ancho') or 2 * g['cx'], c.get('alto') or 2 * g['cy']
        if 0 <= x < ancho and 0 <= y < alto:
            margen = min(x, ancho - x, y, alto - y) * c['gsd']
            mejores.append((c.get('gsdOrigen') == 'supuesto', -margen, c, x, y))
    if mejores:
        _, _, c, x, y = min(mejores, key=lambda t: (t[0], t[1]))
        if c.get('gsdOrigen') == 'supuesto':
            return 'gsd_supuesto', None
        return c, x, y
    cerca = [(c, _distancia_m(lat, lon, c['geo']['lat'], c['geo']['lon'])) for c in capturas
             if (c.get('geo') or {}).get('lat') is not None and (c.get('geo') or {}).get('lon') is not None]
    inclinadas = [d for c, d in cerca if not c['geo'].get('georreferenciable')
                  and d <= max(30.0, c['geo'].get('alturaRelativaM') or 0)]
    if inclinadas:
        return 'captura_inclinada', None
    return 'fuera_capturas', (round(min(d for _, d in cerca)) if cerca else None)


def _reducir(a, f):
    a = np.asarray(a, dtype=np.float32)
    if f <= 1:
        return a
    h, w = a.shape[0] // f, a.shape[1] // f
    return a[:h * f, :w * f].reshape(h, f, w, f).mean(axis=(1, 3))


def _robusto(valores):
    v = np.asarray(valores, dtype=np.float64)
    mediana = float(np.median(v))
    escala = 1.4826 * float(np.median(np.abs(v - mediana)))
    return mediana, max(escala, PARAMETROS['escalaMinima'])


def preparar(bandas, gsd, radio_m, p=None, detectar=copas.detectar_copas):
    """Prepara una captura (bandas del mismo tamaño, `gsd` en m por píxel de esas bandas) para evaluar puntos."""
    p = {**PARAMETROS, **(p or {})}
    f = max(1, int(round(p['resolucionTrabajoM'] / gsd)))
    red = {b: _reducir(bandas[b], f) for b in ('green', 'red', 'rededge', 'nir')}
    idx = {n: calculo.calcular(n, red[a], red[b]) for n, (_, a, b) in calculo.FORMULAS.items()}
    veg = np.isfinite(idx['NDVI']) & (idx['NDVI'] >= p['umbralVegetacion'])
    gsd_t = gsd * f
    r_px = radio_m / gsd_t
    lado = max(2, int(round(r_px * math.sqrt(math.pi))))  # cuadrado de igual área que el círculo
    paso = max(1, lado // 2)
    alto, ancho = veg.shape
    ventanas = []
    for i in range(0, alto - lado + 1, paso):
        for j in range(0, ancho - lado + 1, paso):
            m = veg[i:i + lado, j:j + lado]
            n = int(m.sum())
            if n < p['minPixelesVegetacion']:
                continue
            ventanas.append((i + lado / 2, j + lado / 2, m.mean(),
                             *(float(np.median(idx[k][i:i + lado, j:j + lado][m])) for k in INDICES)))
    ventanas = np.array(ventanas, dtype=np.float64).reshape(-1, 3 + len(INDICES))
    lista_copas = None
    try:
        ndvi_full = calculo.calcular('NDVI', bandas['nir'], bandas['red'])
        lista_copas = detectar(bandas['nir'], ndvi_full, gsd).get('copas') or []
    except (ValueError, KeyError):
        lista_copas = None
    centros, ndre_copas = np.empty((0, 2)), np.empty(0)
    if lista_copas:
        centros = np.array([[c['y'], c['x']] for c in lista_copas], dtype=np.float64)
        valores = []
        for c in lista_copas:
            cy, cx = int(c['y'] / f), int(c['x'] / f)
            rr = max(1, int(c.get('diametroM', 0.8) / 4 / gsd_t))
            trozo = idx['NDRE'][max(0, cy - rr):cy + rr + 1, max(0, cx - rr):cx + rr + 1]
            trozo = trozo[np.isfinite(trozo)]
            valores.append(float(trozo.mean()) if trozo.size else np.nan)
        ndre_copas = np.array(valores)
    return dict(f=f, gsd=gsd, gsdTrabajo=gsd_t, radioM=radio_m, rPx=r_px, idx=idx, veg=veg, ventanas=ventanas,
                copas=lista_copas, centrosCopas=centros, ndreCopas=ndre_copas, forma=(alto * f, ancho * f), p=p)


def _r(v, d=2):
    return None if v is None or not np.isfinite(v) else round(float(v), d)


def medir(ctx, x, y):
    """Métricas del entorno de (x, y) (píxeles de las bandas a resolución completa) frente al resto de la captura.
    Devuelve (métricas, motivo) con motivo None si alcanza para comparar."""
    p, f, r = ctx['p'], ctx['f'], ctx['rPx']
    cx, cy = x / f, y / f
    alto, ancho = ctx['veg'].shape
    y0, y1 = max(0, int(cy - r)), min(alto, int(math.ceil(cy + r)) + 1)
    x0, x1 = max(0, int(cx - r)), min(ancho, int(math.ceil(cx + r)) + 1)
    yy, xx = np.mgrid[y0:y1, x0:x1]
    circulo = (yy + 0.5 - cy) ** 2 + (xx + 0.5 - cx) ** 2 <= r ** 2
    dentro = int(circulo.sum())
    fraccion = dentro / (math.pi * r * r) if r > 0 else 0
    veg = ctx['veg'][y0:y1, x0:x1] & circulo
    nveg = int(veg.sum())
    metricas = dict(radioM=_r(ctx['radioM'], 1), areaM2=_r(dentro * ctx['gsdTrabajo'] ** 2, 0),
                    pixelesCamara=dentro * f * f, gsdCm=_r(ctx['gsd'] * 100, 1),
                    coberturaVegetalPct=_r(100 * nveg / dentro, 0) if dentro else None)
    if fraccion < p['fraccionDentroMin']:
        return metricas, 'borde'
    if dentro * f * f < p['minPixelesNativos'] or nveg < p['minPixelesVegetacion']:
        return metricas, 'pocos_pixeles'
    v = ctx['ventanas']
    lejos = v[(v[:, 0] - cy) ** 2 + (v[:, 1] - cx) ** 2 > (2 * r) ** 2] if len(v) else v
    metricas['ventanasComparadas'] = int(len(lejos))
    if len(lejos) < p['minVentanas']:
        return metricas, 'pocas_ventanas'
    metricas['coberturaVegetalRestoPct'] = _r(100 * float(np.median(lejos[:, 2])), 0)
    for k, nombre in enumerate(INDICES):
        entorno = float(np.median(ctx['idx'][nombre][y0:y1, x0:x1][veg]))
        mediana, escala = _robusto(lejos[:, 3 + k])
        metricas[nombre] = dict(entorno=_r(entorno, 3), resto=_r(mediana, 3), z=_r((entorno - mediana) / escala, 1),
                                percentil=int(round(100 * float(np.mean(lejos[:, 3 + k] < entorno)))))
    if ctx['copas'] is not None:
        c = ctx['centrosCopas']
        r_full = ctx['radioM'] / ctx['gsd']
        en = ((c[:, 0] - y) ** 2 + (c[:, 1] - x) ** 2 <= r_full ** 2) if len(c) else np.zeros(0, bool)
        n_en, n_resto = int(en.sum()), int(len(c) - en.sum())
        area_en = dentro * ctx['gsdTrabajo'] ** 2
        area_total = ctx['forma'][0] * ctx['forma'][1] * ctx['gsd'] ** 2
        copas_m = dict(entorno=n_en)
        if n_resto and area_total > area_en:
            copas_m['densidadRelativa'] = _r((n_en / area_en) / (n_resto / (area_total - area_en)), 2)
        validos = np.isfinite(ctx['ndreCopas'])
        if n_en >= p['minCopasEntorno'] and n_resto >= p['minCopasEntorno'] and validos.sum():
            corte = np.percentile(ctx['ndreCopas'][validos], p['percentilCopaAnomala'])
            baja = validos & (ctx['ndreCopas'] < corte)
            frac_en = float(baja[en].sum()) / n_en
            frac_resto = float(baja[~en].sum()) / n_resto
            copas_m.update(ndreBajoPct=_r(100 * frac_en, 0), ndreBajoRestoPct=_r(100 * frac_resto, 0),
                           agrupamiento=_r(frac_en / frac_resto, 1) if frac_resto > 0 else None)
        metricas['copas'] = copas_m
    return metricas, None


def senal(metricas, p=None):
    """'baja' (vigor del entorno por debajo del resto), 'normal' o 'intermedia'."""
    p = {**PARAMETROS, **(p or {})}
    z_re, z_g = metricas['NDRE']['z'], metricas['GNDVI']['z']
    agrup = (metricas.get('copas') or {}).get('agrupamiento')
    if z_re <= p['zBaja'] and (z_g <= p['zNormal'] or (agrup is not None and agrup >= p['enriquecimientoMin'])):
        return 'baja'
    if z_re > p['zNormal'] and z_g > p['zNormal'] and not (agrup is not None and agrup >= p['enriquecimientoMin'] * 1.5):
        return 'normal'
    return 'intermedia'


def _numero(v, d=1):
    return f'{v:.{d}f}'.replace('.', ',')


def _explicar(veredicto, s, m, firma):
    re_, g = m['NDRE'], m['GNDVI']
    datos = (f"NDRE del entorno {_numero(re_['entorno'], 3)} frente a {_numero(re_['resto'], 3)} del resto "
             f"(z {_numero(re_['z'])}, percentil {re_['percentil']} de {m['ventanasComparadas']} zonas), "
             f"GNDVI z {_numero(g['z'])}")
    cop = m.get('copas') or {}
    if cop.get('agrupamiento') is not None:
        datos += f"; copas con NDRE bajo: {cop['ndreBajoPct']:.0f} % en el entorno frente a {cop['ndreBajoRestoPct']:.0f} % en el resto"
    if veredicto == 'consistente':
        return (f'{datos}. Coherente con lo reportado: el dron ve el vigor del entorno '
                + ('alterado' if firma == 'baja' else 'normal') + ' frente al resto, sin confirmar la causa.')
    if veredicto == 'no_consistente':
        return (f'{datos}. No coherente con lo reportado: el dron ve el entorno '
                + ('igual o mejor que el resto' if s == 'normal' else 'con vigor reducido') + '.')
    return datos + '.'


def _regla_texto(regla):
    if not regla:
        return None
    estado = regla.get('estado')
    return (f"{regla['tipo']} v{regla.get('version')} ({estado}"
            + (', sin calibrar' if not regla.get('calibrada') else '') + ')')


def evaluar(reportes, capturas, cargar, siembra=None, reglas=None, parametros=None, detectar=copas.detectar_copas):
    """reportes: [{lat, lon, clase, origen, diasDesdeVuelo}]; capturas: [{id, geo, gsd, gsdOrigen, ancho, alto}]
    (geo y gsd en píxeles NIR originales); cargar(id) → (bandas del mismo tamaño, ancho NIR original)."""
    p = {**PARAMETROS, **(parametros or {})}
    radio_m, radio_origen = radio_entorno(siembra, p.get('radioEntornoM'), p['plantasEntorno'])
    reglas = {r['tipo']: r for r in (reglas or []) if r.get('tipo')}
    filas = []
    por_captura = {}
    for n, rep in enumerate(reportes):
        tipo = tipo_de_clase(rep.get('clase'))
        fila = dict(clase=rep.get('clase'), tipo=tipo, origen=rep.get('origen'), dias=rep.get('diasDesdeVuelo'),
                    firma=FIRMAS.get(tipo), veredicto='no_concluyente', motivo=None, metricas=None, captura=None,
                    distanciaM=None, razon=None, fito=estado_fitosanitario(rep.get('revision')))
        filas.append(fila)
        lat, lon = rep.get('lat'), rep.get('lon')
        if lat is None or lon is None or not (math.isfinite(lat) and math.isfinite(lon)):
            fila['motivo'] = 'sin_coordenadas'
            continue
        u = ubicar(lat, lon, capturas)
        if isinstance(u[0], str):
            fila['motivo'], fila['distanciaM'] = u
            continue
        c, x, y = u
        fila['captura'] = c['id']
        por_captura.setdefault(c['id'], []).append((fila, x, y))
    orden = sorted(por_captura, key=lambda k: -len(por_captura[k]))
    for k, cid in enumerate(orden):
        grupo = por_captura[cid]
        if k >= p['maxCapturas']:
            for fila, _, _ in grupo:
                fila['motivo'] = 'limite_capturas'
            continue
        try:
            bandas, ancho_nir = cargar(cid)
        except KeyError:
            for fila, _, _ in grupo:
                fila['motivo'] = 'sin_bandas'
            continue
        except Exception:
            for fila, _, _ in grupo:
                fila['motivo'] = 'error_lectura'
            continue
        info = next(c for c in capturas if c['id'] == cid)
        escala = ancho_nir / next(iter(bandas.values())).shape[1]
        ctx = preparar(bandas, info['gsd'] * escala, radio_m, p, detectar)
        for fila, x, y in grupo:
            m, motivo = medir(ctx, x / escala, y / escala)
            fila['metricas'] = m
            fila['gsdOrigen'] = info.get('gsdOrigen')
            if motivo:
                fila['motivo'] = motivo
                continue
            s = senal(m, p)
            fila['senal'] = s
            if fila['firma'] is None:
                fila['motivo'] = 'sin_firma'
            elif s == 'intermedia':
                fila['motivo'] = 'senal_intermedia'
            else:
                fila['veredicto'] = 'consistente' if s == fila['firma'] else 'no_consistente'
            if fila['dias'] is not None and abs(fila['dias']) > p['maxDiasDiferencia']:
                fila['motivo'], fila['veredicto'] = 'fecha_lejana', 'no_concluyente'
            fila['razon'] = _explicar(fila['veredicto'], s, m, fila['firma'])
        del ctx, bandas
    for fila in filas:  # la fecha también se avisa en los que no se pudieron medir
        if fila['motivo'] is None and fila['veredicto'] == 'no_concluyente':
            fila['motivo'] = 'senal_intermedia'
    return _resumir(filas, radio_m, radio_origen, reglas, p)


def _resumir(filas, radio_m, radio_origen, reglas, p):
    resumen = {'consistente': 0, 'no_consistente': 0, 'no_concluyente': 0}
    por_tipo, motivos, grupos = {}, {}, {}
    for f in filas:
        resumen[f['veredicto']] += 1
        t = por_tipo.setdefault(f['tipo'] or 'sin clase', {'consistente': 0, 'no_consistente': 0, 'no_concluyente': 0})
        t[f['veredicto']] += 1
        if f['motivo']:
            motivos[MOTIVOS[f['motivo']]] = motivos.get(MOTIVOS[f['motivo']], 0) + 1
        m = f['metricas'] or {}
        clave = (f['tipo'], f['veredicto'], f['motivo'], f['captura'],
                 (m.get('NDRE') or {}).get('entorno'), (m.get('NDRE') or {}).get('z'), tuple(sorted(f['fito'].items())))
        g = grupos.get(clave)
        if g is None:
            regla = reglas.get(f['tipo'])
            g = grupos[clave] = dict(
                clase=f['clase'], tipo=f['tipo'], reportes=0, veredicto=f['veredicto'],
                motivo=MOTIVOS[f['motivo']] if f['motivo'] else None,
                diasDesdeVuelo=None, distanciaCapturaM=f['distanciaM'],
                regla=_regla_texto(regla), metricas=f['metricas'], gsdOrigen=f.get('gsdOrigen'), razon=f['razon'],
                fitosanitario=f['fito'])
        g['reportes'] += 1
        if f['dias'] is not None:
            d = round(f['dias'], 1)
            g['diasDesdeVuelo'] = [d, d] if g['diasDesdeVuelo'] is None else [min(g['diasDesdeVuelo'][0], d), max(g['diasDesdeVuelo'][1], d)]
        if f['distanciaM'] is not None:
            g['distanciaCapturaM'] = min(g['distanciaCapturaM'] or f['distanciaM'], f['distanciaM'])
    # Primero lo medido (con métricas), luego lo más numeroso
    ordenados = sorted(grupos.values(), key=lambda g: (g['metricas'] is None, g['veredicto'] == 'no_concluyente', -g['reportes']))
    listados = [{k: v for k, v in g.items() if v is not None} for g in ordenados[:p['maxGruposListados']]]
    tipos = {f['tipo'] for f in filas}
    reglas_usadas = [dict(tipo=r['tipo'], version=r.get('version'), estado=r.get('estado'), calibrada=bool(r.get('calibrada')),
                          fuente=r.get('fuente'), cortesIncidenciaPct=r.get('cortesIncidenciaPct') or [],
                          nota=('Borrador sin aprobar por un agrónomo. ' if r.get('estado') == 'borrador' else '')
                          + ('Sin calibrar. ' if not r.get('calibrada') else '')
                          + ('Sin fuente citada.' if not r.get('fuente') else 'Fuente citada en la regla.'))
                     for t, r in sorted(reglas.items()) if t in tipos]
    return dict(
        metodo='entorno de plantas frente al resto de la misma captura (NDVI, NDRE, GNDVI y copas en NIR)',
        radioEntornoM=round(radio_m, 1), radioOrigen=radio_origen, firmaEsperada=FIRMA_TEXTO,
        total=len(filas), resumen=resumen, porTipo=por_tipo, motivosNoConcluyente=motivos,
        grupos=listados, gruposOmitidos=max(0, len(ordenados) - len(listados)),
        reglas=reglas_usadas,
        notaReglas=('Las reglas de zona convierten incidencia y severidad en un radio; no definen una firma espectral ni se '
                    'usan para decidir el veredicto. La incidencia que estima el celular no se guarda en el servidor, así que '
                    'no se ubica en sus cortes.') if reglas_usadas else None,
        umbrales=dict(zBaja=p['zBaja'], zNormal=p['zNormal'], provisionales=True),
        fitosanitario=seccion_fitosanitaria(filas),
        avisos=[a for a in AVISOS if a != AVISO_PENDIENTE or any(
            f['fito']['estado'] == 'hipotesis_sin_verificar' for f in filas)],
    )


def seccion_fitosanitaria(filas):
    """Sección que el chat y el PDF muestran SIEMPRE: hipótesis del celular o lo que concluyó el agrónomo."""
    if not filas:
        return dict(estado='sin_reportes', texto='No hay reportes de la app cerca del vuelo: no hay hipótesis '
                    'fitosanitaria que contrastar con el dron.', avisos=[AVISO_PROPAGACION])
    pendientes = [f for f in filas if f['fito']['estado'] == 'hipotesis_sin_verificar']
    verificados = [f for f in filas if f['fito']['estado'] == 'verificado_por_agronomo']
    estado = ('verificado_por_agronomo' if not pendientes else
              'hipotesis_sin_verificar' if not verificados else 'parcialmente_verificado')
    partes = []
    if pendientes:
        clases = {}
        for f in pendientes:
            clases[f['clase'] or 'sin clase'] = clases.get(f['clase'] or 'sin clase', 0) + 1
        conteo = {v: sum(f['veredicto'] == v for f in pendientes) for v in ('consistente', 'no_consistente', 'no_concluyente')}
        partes.append(
            'HIPÓTESIS sin verificar (no es un diagnóstico): el celular sospecha '
            + ', '.join(f'{c} ({n})' for c, n in sorted(clases.items(), key=lambda t: -t[1]))
            + f"; el dron es coherente en {conteo['consistente']}, no coherente en {conteo['no_consistente']} y no "
              f"concluyente en {conteo['no_concluyente']}. Diagnóstico pendiente de un agrónomo.")
    lista = {}
    for f in verificados:
        v = f['fito']
        clave = (f['clase'], v['conclusion'], v['plagaIdentificada'], v['agronomo'], v['fecha'], f['veredicto'])
        lista.setdefault(clave, dict(clase=f['clase'], conclusion=v['conclusion'], tipoResultado=v['tipoResultado'],
                                     plagaIdentificada=v['plagaIdentificada'], agronomo=v['agronomo'],
                                     fecha=v['fecha'], veredictoDron=f['veredicto'], reportes=0))['reportes'] += 1
    for v in list(lista.values())[:5]:
        partes.append(f"Verificado por agrónomo{(' ' + v['agronomo']) if v['agronomo'] else ''}"
                      f"{(' el ' + v['fecha']) if v['fecha'] else ''}: {v['tipoResultado']}"
                      f"{(' (' + v['plagaIdentificada'] + ')') if v['plagaIdentificada'] else ''} sobre lo reportado como "
                      f"{v['clase'] or 'sin clase'}.")
    solicitudes = {}
    for f in pendientes:
        solicitudes[f['fito']['solicitud']] = solicitudes.get(f['fito']['solicitud'], 0) + 1
    return dict(estado=estado, texto=' '.join(partes), hipotesisPendientes=len(pendientes),
                pendientesPorSolicitud=solicitudes, verificados=list(lista.values())[:5],
                avisos=([AVISO_PENDIENTE] if pendientes else []) + [AVISO_PROPAGACION])
