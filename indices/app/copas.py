"""Detección experimental de copas por brillo NIR; filtros únicamente con numpy."""
import numpy as np

# Todos los umbrales: provisional, calibrar con conteos manuales.
# Contraste 0,25 y valle 0,25 descartaban el follaje denso (33 de 78 copas contadas a mano en un recorte denso);
# con 0,05 y 0,03 el recorte denso da 63 de 78 y uno disperso 37 de 38. En un cuarto recorte, no usado para ajustar,
# cuenta 35 frente a 24 contadas a mano (+46 %, falsos positivos sobre pasto). Un filtro de brillo global (Otsu) no lo
# arregla sin perder copas reales en otros recortes. Error observado: de −19 % a +46 %. Sigue siendo experimental.
PARAMETROS = dict(umbralNdvi=0.4, copaTipicaM=0.8, copaMinM=0.4,
                  copaMaxM=2.5, fusionDistanciaFactor=1.3,
                  fondoAnchoM=6.0, contrasteMinimo=0.05, fraccionArea=0.5, valleMinimo=0.03,
                  sigmaFactor=0.25, radioMaximoFactor=0.5, reduccion=2,
                  truncadoGaussiano=3.0, clasificarAtipicas=False,
                  atipicaAreaMinM2=None, atipicaDiametroMinM=None,
                  atipicaSolidezMax=None, atipicaExcentricidadMin=None,
                  atipicaTexturaNirMin=None, atipicaNdviMax=None,
                  atipicaContrasteMin=None, atipicaNumeroMaximosMin=None)
ADVERTENCIA = ('Conteo estimado por detección de copas en NIR; no está validado contra un conteo manual. '
               'Las masas grandes y las atípicas requieren revisión humana; no se infiere su especie. '
               'Sin clasificación se conserva la exclusión histórica de masas y su área; con clasificación se usa el área total.')
ADVERTENCIA_GSD = ('Hay capturas con GSD nominal: la altura es relativa al despegue y en terreno inclinado '
                   'el tamaño del píxel puede estar sobrestimado.')


def _gaussiana(a, sigma, truncado):
    radio = max(1, int(np.ceil(truncado * sigma)))
    x = np.arange(-radio, radio + 1)
    pesos = np.exp(-0.5 * (x / sigma) ** 2)
    pesos /= pesos.sum()
    for eje in (0, 1):
        pad = [(0, 0), (0, 0)]
        pad[eje] = (radio, radio)
        extendida = np.pad(a, pad, mode='edge')
        salida = np.zeros_like(a)
        for i, peso in enumerate(pesos):
            trozo = [slice(None), slice(None)]
            trozo[eje] = slice(i, i + a.shape[eje])
            salida += peso * extendida[tuple(trozo)]
        a = salida
    return a


def _fondo(a, radio):
    """Media ancha separable con sumas acumuladas: coste independiente del radio."""
    for eje in (0, 1):
        pad = [(0, 0), (0, 0)]
        pad[eje] = (radio, radio)
        extendida = np.pad(a, pad, mode='edge')
        ceros = list(extendida.shape)
        ceros[eje] = 1
        acumulada = np.concatenate((np.zeros(ceros), np.cumsum(extendida, axis=eje, dtype=np.float64)), axis=eje)
        a = (np.take(acumulada, range(2*radio+1, extendida.shape[eje]+1), axis=eje)
             - np.take(acumulada, range(a.shape[eje]), axis=eje)) / (2*radio+1)
        a = a.astype(np.float32)
    return a


def _componentes(mascara):
    """Etiquetado de ocho vecinos por tramos horizontales, sin recorrer cada píxel."""
    etiquetas = np.zeros(mascara.shape, dtype=np.int32)
    padres = [0]
    def raiz(i):
        while padres[i] != i:
            padres[i] = padres[padres[i]]
            i = padres[i]
        return i
    anteriores = []
    for y, fila in enumerate(mascara):
        cambios = np.diff(np.pad(fila.astype(np.int8), (1, 1)))
        tramos = []
        j = 0
        for inicio, fin in zip(np.flatnonzero(cambios == 1), np.flatnonzero(cambios == -1)):
            etiqueta = len(padres)
            padres.append(etiqueta)
            while j < len(anteriores) and anteriores[j][1] < inicio:
                j += 1
            k = j
            while k < len(anteriores) and anteriores[k][0] <= fin:
                padres[raiz(anteriores[k][2])] = raiz(etiqueta)
                k += 1
            etiquetas[y, inicio:fin] = etiqueta
            tramos.append((inicio, fin, etiqueta))
        anteriores = tramos
    mapa = np.array([raiz(i) for i in range(len(padres))])
    return mapa[etiquetas]


def _resumen(valores, minimo):
    if len(valores) < minimo:
        return None
    media = float(np.mean(valores))
    return dict(media=media, mediana=float(np.median(valores)),
                cv=float(np.std(valores) / media) if media > 0 else None)


# Umbrales provisionales: calibrar con conteos manuales. None desactiva cada condición.
UMBRALES_ATIPICAS = {
    'atipicaAreaMinM2': ('areaRegionM2', 'min'),
    'atipicaDiametroMinM': ('diametroM', 'min'),
    'atipicaSolidezMax': ('solidez', 'max'),
    'atipicaExcentricidadMin': ('excentricidad', 'min'),
    'atipicaTexturaNirMin': ('texturaNir', 'min'),
    'atipicaNdviMax': ('ndviMedio', 'max'),
    'atipicaContrasteMin': ('contrasteMedio', 'min'),
    'atipicaNumeroMaximosMin': ('numeroMaximos', 'min'),
}


def _es_atipica(copa, p):
    condiciones = []
    for clave, (rasgo, sentido) in UMBRALES_ATIPICAS.items():
        if p[clave] is not None:
            valor = copa.get(rasgo)
            condiciones.append(valor is not None and
                               (valor >= p[clave] if sentido == 'min' else valor <= p[clave]))
    return bool(p['clasificarAtipicas'] and condiciones and all(condiciones))


def _forma(region):
    """Casco de celdas completas: extremos por fila, O(alto log alto)."""
    yy, xx = np.nonzero(region)
    if not len(xx):
        return None, None
    puntos = []
    for y in np.unique(yy):
        xs = np.flatnonzero(region[y])
        for x in (int(xs[0]), int(xs[-1])+1):
            puntos.extend(((x, int(y)), (x, int(y)+1)))
    puntos = sorted(set(puntos))
    def cruz(o, a, b):
        return (a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0])
    def mitad(ps):
        casco = []
        for punto in ps:
            while len(casco) >= 2 and cruz(casco[-2], casco[-1], punto) <= 0:
                casco.pop()
            casco.append(punto)
        return casco[:-1]
    casco = np.asarray(mitad(puntos)+mitad(puntos[::-1]), dtype=float)
    area = abs(np.sum(casco[:, 0]*np.roll(casco[:, 1], -1)
                      -casco[:, 1]*np.roll(casco[:, 0], -1)))/2
    # Momentos de celdas cuadradas uniformes: varianza interna 1/12.
    coords = np.array([xx-xx.mean(), yy-yy.mean()])
    momentos = coords @ coords.T / len(xx) + np.eye(2)/12
    menor, mayor = np.linalg.eigvalsh(momentos)
    return float(len(xx)/area) if area else None, float(np.sqrt(max(0., 1-menor/mayor)))


def _rasgos(region, nir, ndvi, contraste, r, sy, sx):
    solidez, excentricidad = _forma(region)
    # No medir textura sobre promedios ni sobre la gaussiana: preservar variación fina.
    mascara = np.repeat(np.repeat(region, r, axis=0), r, axis=1)
    corte = np.s_[sy*r:(sy+region.shape[0])*r, sx*r:(sx+region.shape[1])*r]
    valores = np.asarray(nir[corte][mascara], dtype=np.float64)
    valores = valores[np.isfinite(valores)]
    indices = np.asarray(ndvi[corte][mascara], dtype=np.float64)
    indices = indices[np.isfinite(indices)]
    media = float(valores.mean()) if valores.size else None
    return dict(solidez=solidez, excentricidad=excentricidad,
                texturaNir=float(valores.std()/media) if media is not None and media > 0 else None,
                ndviMedio=float(indices.mean()) if indices.size else None,
                contrasteMedio=float(contraste[region].mean()) if region.any() else None)


def detectar_copas(nir, ndvi, gsd_m, parametros=None, recorte=None):
    if gsd_m is None or not np.isfinite(gsd_m) or gsd_m <= 0:
        raise ValueError('El GSD debe ser finito y positivo.')
    nir, ndvi = np.asarray(nir), np.asarray(ndvi)
    if nir.ndim != 2 or nir.shape != ndvi.shape or min(nir.shape) == 0:
        raise ValueError('NIR y NDVI deben ser matrices 2D no vacías del mismo tamaño.')
    p = {**PARAMETROS, **(parametros or {})}
    if set(p) != set(PARAMETROS) or any(
            not isinstance(v, (int, float, np.number, bool)) or not np.isfinite(v)
            for k, v in p.items() if not (k in UMBRALES_ATIPICAS and v is None)):
        raise ValueError('Parámetros de copas desconocidos o no finitos.')
    if not isinstance(p['clasificarAtipicas'], bool):
        raise ValueError('clasificarAtipicas debe ser booleano.')
    if any(v <= 0 for k, v in p.items() if k not in UMBRALES_ATIPICAS and k not in ('umbralNdvi', 'clasificarAtipicas')) or p['copaMaxM'] < p['copaMinM'] or int(p['reduccion']) != p['reduccion']:
        raise ValueError('Tamaños, factores y reducción deben ser positivos y compatibles.')
    if not 0 < p['fraccionArea'] < 1 or not 0 < p['valleMinimo'] < 1:
        raise ValueError('Las fracciones de área y valle deben estar entre cero y uno.')
    h, w = nir.shape
    borde = p['copaMinM'] / (2 * gsd_m)
    limites = (borde, borde, w-borde, h-borde)
    if recorte is not None:
        if len(recorte) != 4 or any(int(v) != v for v in recorte):
            raise ValueError('El recorte requiere cuatro píxeles enteros.')
        x0, y0, x1, y1 = recorte
        if not (0 <= x0 < x1 <= w and 0 <= y0 < y1 <= h):
            raise ValueError('Recorte fuera de la imagen o vacío.')
        limites = recorte
    x0, y0, x1, y1 = limites
    area = max(0., x1-x0) * max(0., y1-y0) * gsd_m ** 2
    salida = dict(copas=[], copasAtipicas=[], atipicasConteo=0, atipicasAreaM2=0., conteo=0, areaAnalizadaM2=area, densidadPlantasHa=0.,
                  diametroCopaM=None, vecinoMasCercanoM=None, fusionadas=0,
                  descartadasGrandes=0, masasGrandes=0, areaMasasGrandesM2=0.,
                  regionesGrandes=[], parametros=p)
    r = min(int(p['reduccion']), h, w)
    # Promedio por bloques, conservando el centro en coordenadas originales.
    hh, ww = h // r, w // r
    valido = np.isfinite(nir) & np.isfinite(ndvi)
    def reducir(a):
        return a[:hh*r, :ww*r].reshape(hh, r, ww, r).mean(axis=(1, 3))
    pesos = reducir(valido.astype(np.float32))
    a = reducir(np.where(valido, nir, 0).astype(np.float32))
    n = reducir(np.where(valido, ndvi, 0).astype(np.float32))
    n = np.divide(n, pesos, out=np.zeros_like(n), where=pesos > 0)
    sigma = p['sigmaFactor'] * p['copaTipicaM'] / (gsd_m * r)
    soporte = _gaussiana(pesos, sigma, p['truncadoGaussiano'])
    suave = np.divide(_gaussiana(a, sigma, p['truncadoGaussiano']), soporte,
                      out=np.zeros_like(a), where=soporte > 0)
    radio_fondo = max(1, int(p['fondoAnchoM'] / (2*gsd_m*r)))
    fondo_pesos = _fondo(pesos, radio_fondo)
    fondo = np.divide(_fondo(a, radio_fondo), fondo_pesos,
                      out=np.zeros_like(a), where=fondo_pesos > 0)
    # Contraste relativo local: independiente de la escala radiométrica del TIFF.
    contraste = (suave-fondo) / np.maximum(np.abs(fondo), 1e-12)
    mascara = (pesos > 0) & (n >= p['umbralNdvi']) & (contraste >= p['contrasteMinimo'])
    if recorte is not None:
        salida.update(recorte=list(recorte), areaRecorteM2=area)
    if area == 0:
        salida['densidadPlantasHa'] = None
        return salida
    suave = contraste
    maximos = suave.copy()
    radio = max(1, int(np.ceil(p['radioMaximoFactor'] * p['copaMinM'] / (gsd_m*r))))
    for eje in (0, 1):
        pad = [(0, 0), (0, 0)]
        pad[eje] = (radio, radio)
        extendida = np.pad(maximos, pad, constant_values=-np.inf)
        for i in range(2*radio+1):
            trozo = [slice(None), slice(None)]
            trozo[eje] = slice(i, i+suave.shape[eje])
            np.maximum(maximos, extendida[tuple(trozo)], out=maximos)
    # Una meseta contigua representa un solo máximo, con desempate determinista.
    mesetas = _componentes(mascara & (suave == maximos))
    yy, xx = np.nonzero(mesetas)
    if not len(xx):
        return salida
    _, primeros = np.unique(mesetas[yy, xx], return_index=True)
    candidatos = sorted(zip(yy[primeros], xx[primeros]), key=lambda t: -float(suave[t]))
    centros = []
    separacion = p['copaMinM'] / (gsd_m*r)
    for y, x in candidatos:
        if all((x-cx)**2+(y-cy)**2 >= separacion**2 for cy, cx in centros):
            centros.append((y, x))
    # Cajas locales evitan etiquetar toda la captura por pico.
    soporte_brillante = (pesos > 0) & (n >= p['umbralNdvi']) & (contraste >= p['contrasteMinimo']*p['fraccionArea'])
    componentes = _componentes(soporte_brillante)
    gy, gx = np.nonzero(componentes)
    etiquetas = componentes[gy, gx]
    cantidad = int(componentes.max())+1
    ymin, xmin = np.full(cantidad, hh), np.full(cantidad, ww)
    ymax, xmax = np.zeros(cantidad, int), np.zeros(cantidad, int)
    np.minimum.at(ymin, etiquetas, gy)
    np.minimum.at(xmin, etiquetas, gx)
    np.maximum.at(ymax, etiquetas, gy)
    np.maximum.at(xmax, etiquetas, gx)
    maximos_por_region = np.bincount(
        [componentes[y, x] for y, x in candidatos], minlength=cantidad)
    grupos = {}
    for y, x in centros:
        grupos.setdefault(int(componentes[y, x]), []).append((y, x))
    excluida = np.zeros((hh, ww), bool)
    for identificador, puntos in grupos.items():
        sy, sx = int(ymin[identificador]), int(xmin[identificador])
        corte = np.s_[sy:ymax[identificador]+1, sx:xmax[identificador]+1]
        local = contraste[corte]
        soporte_local = componentes[corte] == identificador
        aceptados = []
        for y, x in puntos:
            # Un máximo necesita el valle relativo configurado respecto al pico menor.
            nivel = contraste[y, x]*(1-p['valleMinimo'])
            altas = _componentes(soporte_local & (local >= nivel))
            etiqueta = altas[y-sy, x-sx]
            if not any(altas[ay-sy, ax-sx] == etiqueta for ay, ax in aceptados):
                aceptados.append((y, x))
        regiones = []
        for y, x in aceptados:
            altas = _componentes(soporte_local & (local >= contraste[y, x]*p['fraccionArea']))
            regiones.append(altas == altas[y-sy, x-sx])
        # Solo se reparte el solapamiento de regiones realmente brillantes.
        dueno = np.full(local.shape, -1, int)
        distancia = np.full(local.shape, np.inf)
        ly, lx = np.indices(local.shape)
        for i, ((y, x), region) in enumerate(zip(aceptados, regiones)):
            d = (ly+sy-y)**2 + (lx+sx-x)**2
            tomar = region & (d < distancia)
            distancia[tomar], dueno[tomar] = d[tomar], i
        for i, (y, x) in enumerate(aceptados):
            ox, oy = float(x*r+(r-1)/2), float(y*r+(r-1)/2)
            region = dueno == i
            superficie = float(region.sum()*(gsd_m*r)**2)
            diametro = float(2*np.sqrt(superficie/np.pi))
            registro = dict(x=ox, y=oy, diametroM=diametro, areaM2=superficie,
                            areaRegionM2=superficie,
                            numeroMaximos=int(maximos_por_region[identificador]),
                            **_rasgos(region, nir, ndvi, local, r, sy, sx))
            fusionada = any(regiones[i][ay-sy, ax-sx]
                            for j, (ay, ax) in enumerate(aceptados) if j != i)
            if (x0 <= ox < x1 and y0 <= oy < y1 and diametro >= p['copaMinM']
                    and (diametro <= p['copaMaxM'] or len(aceptados) == 1)
                    and _es_atipica(registro, p)):
                salida['copasAtipicas'].append(dict(**registro, fusionada=bool(fusionada)))
                continue
            if len(aceptados) == 1 and diametro > p['copaMaxM']:
                excluida[corte] |= region
                if x0 <= ox < x1 and y0 <= oy < y1:
                    salida['regionesGrandes'].append(registro)
                continue
            if not (x0 <= ox < x1 and y0 <= oy < y1) or not p['copaMinM'] <= diametro <= p['copaMaxM']:
                continue
            salida['copas'].append(dict(**registro, fusionada=bool(fusionada)))
    # Intersección de celdas reducidas con el rectángulo analizado.
    anchos = np.maximum(0, np.minimum(np.arange(ww)*r+r, x1)-np.maximum(np.arange(ww)*r, x0))
    altos = np.maximum(0, np.minimum(np.arange(hh)*r+r, y1)-np.maximum(np.arange(hh)*r, y0))
    area_grande = float(np.sum(excluida*altos[:, None]*anchos[None, :])*gsd_m**2)
    area = area if p['clasificarAtipicas'] else max(0., area-area_grande)
    salida.update(atipicasConteo=len(salida['copasAtipicas']),
                  atipicasAreaM2=sum(c['areaRegionM2'] for c in salida['copasAtipicas']))
    salida.update(masasGrandes=len(salida['regionesGrandes']),
                  descartadasGrandes=len(salida['regionesGrandes']),
                  areaMasasGrandesM2=area_grande, areaAnalizadaM2=area)
    copas = salida['copas']
    vecinos = []
    for i, copa in enumerate(copas):
        if len(copas) > 1:
            distancia = min(np.hypot(copa['x']-otra['x'], copa['y']-otra['y'])*gsd_m
                            for j, otra in enumerate(copas) if j != i)
            vecinos.append(float(distancia))
            copa['fusionada'] |= bool(distancia < p['copaMinM']*p['fusionDistanciaFactor'])
    salida.update(conteo=len(copas), densidadPlantasHa=len(copas)/area*10000 if area > 0 else None,
                  diametroCopaM=_resumen([c['diametroM'] for c in copas], 3),
                  vecinoMasCercanoM=_resumen(vecinos, 2), fusionadas=sum(c['fusionada'] for c in copas))
    return salida


ADVERTENCIA_GSD_SUPUESTO = ('Hay capturas sin focal calibrada: su GSD se supuso con la altura relativa y el campo de visión '
                            'de la cámara multiespectral DJI Mavic 3M. Su conteo y su densidad son muy poco fiables, solo orientativos.')
ADVERTENCIA_RESOLUCION = ('Hay capturas con píxeles de más de {:.0f} cm: una copa de café ocupa pocos píxeles, las copas '
                          'vecinas se funden y el conteo probablemente subestima las plantas.')
GSD_MAXIMO_FIABLE_M = 0.05


def motivo_sin_conteo(referencia, gsd):
    """Por qué una captura no admite el conteo de copas, o None si se puede contar."""
    if gsd is None:
        return 'sin altura relativa ni focal en los metadatos: no hay escala para medir copas'
    inclinacion = referencia.get('pitchGrados')
    if inclinacion is None:
        if referencia.get('georreferenciable'):
            return None
        return 'sin ángulo del gimbal: no se puede comprobar que la captura sea cenital'
    if abs(inclinacion + 90) > 5:
        return f'captura inclinada ({inclinacion:.0f}°): la escala cambia dentro de la imagen'
    return None


def resumir_capturas(capturas, teorica=None):
    densidades = [c['densidadPlantasHa'] for c in capturas if c['densidadPlantasHa'] is not None]
    media = float(np.mean(densidades)) if densidades else None
    contadas = [c for c in capturas if c.get('conteo') is not None]
    advertencias = [ADVERTENCIA]
    if any(c['gsdOrigen'] == 'nominal' for c in capturas):
        advertencias.append(ADVERTENCIA_GSD)
    if any(c['gsdOrigen'] == 'supuesto' for c in contadas):
        advertencias.append(ADVERTENCIA_GSD_SUPUESTO)
    if any((c.get('gsdM') or 0) > GSD_MAXIMO_FIABLE_M for c in contadas):
        advertencias.append(ADVERTENCIA_RESOLUCION.format(GSD_MAXIMO_FIABLE_M*100))
    advertencias += [f"Captura {c['capturaId']}: sin conteo ({c['motivoSinConteo']})."
                     for c in capturas if c.get('conteo') is None and c.get('motivoSinConteo')]
    if not contadas:
        advertencias.append('No se obtuvo conteo de copas en ninguna captura analizada.')
    origenes = {c['gsdOrigen'] for c in contadas}
    fiabilidad = (None if not contadas else 'muy baja' if 'supuesto' in origenes
                  or any((c.get('gsdM') or 0) > GSD_MAXIMO_FIABLE_M for c in contadas) else 'baja')
    return dict(metodo='maximos_locales_nir', validado=False, porCaptura=capturas,
                capturasConConteo=len(contadas), fiabilidad=fiabilidad,
                densidadMediaPlantasHa=media,
                diferenciaVsTeoricaPct=(media-teorica)/teorica*100 if media is not None and teorica else None,
                advertencias=advertencias)
