"""GSD local por traslación multiescala de textura NIR y GPS."""
import math
import numpy as np
from PIL import Image
from . import geo


def _correlacion(primera, segunda, escala):
    alto, ancho = primera.shape
    tamano = (ancho // escala, alto // escala)
    ventana = np.outer(np.hanning(tamano[1]), np.hanning(tamano[0]))
    espectros = []
    for imagen in (primera, segunda):
        reducida = np.asarray(Image.fromarray(imagen.astype(np.float32)).resize(tamano, Image.Resampling.BOX))
        reducida = np.hypot(*np.gradient(reducida))
        espectros.append(np.fft.fft2((reducida - reducida.mean()) * ventana))
    producto = espectros[1] * espectros[0].conj()
    magnitud = np.abs(producto)
    normalizado = np.divide(producto, magnitud, out=np.zeros_like(producto), where=magnitud > 0)
    superficie = np.fft.ifft2(normalizado).real
    fila, col = np.unravel_index(np.argmax(superficie), superficie.shape)
    pico = float(superficie[fila, col])

    def refinar(pos, eje):
        anterior = superficie[(fila - 1) % tamano[1], col] if eje == 0 else superficie[fila, (col - 1) % tamano[0]]
        siguiente = superficie[(fila + 1) % tamano[1], col] if eje == 0 else superficie[fila, (col + 1) % tamano[0]]
        divisor = anterior - 2 * pico + siguiente
        ajuste = float(0.5 * (anterior - siguiente) / divisor) if divisor else 0.
        longitud = superficie.shape[eje]
        return (pos + ajuste + longitud / 2) % longitud - longitud / 2

    dx, dy = refinar(col, 1) * ancho / tamano[0], refinar(fila, 0) * alto / tamano[1]
    return {'dx': dx, 'dy': dy, 'modulo': math.hypot(dx, dy)}


def distancia_y_rumbo(a, b):
    """Haversine en metros y rumbo inicial horario desde el norte."""
    lat1, lat2 = math.radians(a['lat']), math.radians(b['lat'])
    dl = math.radians(b['lon'] - a['lon'])
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dl / 2) ** 2
    distancia = 6371000 * 2 * math.asin(math.sqrt(min(1., max(0., h))))
    rumbo = math.degrees(math.atan2(math.sin(dl) * math.cos(lat2),
                                  math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dl)))
    return distancia, rumbo


def desplazamiento_multiescala(a, b, escalas=(2, 4, 8), tolerancia=0.04):
    """Desplazamiento del contenido en píxeles originales, referido a 1/4."""
    salida = dict(dx=None, dy=None, modulo=None, coincide=False, desplazamientos={}, motivo=None)
    if a.shape != b.shape or a.ndim != 2 or min(a.shape) < 64:
        salida['motivo'] = 'Dimensiones incompatibles o menores de 64 píxeles.'
        return salida
    if not np.isfinite(a).all() or not np.isfinite(b).all():
        salida['motivo'] = 'Imagen con valores no finitos.'
        return salida
    if 4 not in escalas or any(e < 1 or min(a.shape) // e < 2 for e in escalas):
        salida['motivo'] = 'Escalas incompatibles: se requiere la referencia 1/4.'
        return salida
    medidas = {e: _correlacion(a, b, e) for e in escalas}
    referencia = medidas[4]
    coincide = referencia['modulo'] > 0 and all(abs(m['modulo'] - referencia['modulo']) <= tolerancia * referencia['modulo'] for m in medidas.values())
    salida.update(**referencia, coincide=coincide, desplazamientos=medidas,
                  motivo=None if coincide else 'Los módulos multiescala no coinciden.')
    return salida


def gsd_para_captura(geo_captura, efectivo):
    if efectivo is not None and math.isfinite(efectivo) and efectivo > 0:
        return efectivo, 'efectivo'
    nominal = geo.gsd_m_px(geo_captura.get('alturaRelativaM'), geo_captura.get('focalPx'))
    return (nominal, 'nominal') if nominal is not None else (None, None)


# Focal en píxeles ÷ ancho de la imagen de la cámara multiespectral DJI Mavic 3M (2170 px / 2592 px, ≈62° horizontal).
# Solo se usa cuando la imagen no trae focal calibrada: es un supuesto, no una medida.
RELACION_FOCAL_SUPUESTA = 2170 / 2592


def gsd_supuesto(geo_captura, ancho_px):
    """GSD de último recurso: altura relativa con el campo de visión supuesto de la cámara. Muy poco fiable."""
    altura = geo._numero(geo_captura.get('alturaRelativaM'))
    if altura is None or altura <= 0 or not ancho_px or ancho_px <= 0:
        return None
    return altura / (RELACION_FOCAL_SUPUESTA * ancho_px)


def _par(a, b):
    salida = dict(primera=a['id'], segunda=b['id'], valido=False, motivo=None,
                  distanciaGpsM=None, modulo=None, gsdEfectivoM=None, gsdNominalM=None,
                  razon=None, errorAngularGrados=None, cambioYawGrados=None,
                  dx=None, dy=None, coincide=False, desplazamientos={})
    g1, g2 = a['geo'], b['geo']
    if not all(g.get('georreferenciable') for g in (g1, g2)):
        salida['motivo'] = 'Cámara no cenital o metadatos geométricos incompletos.'
        return salida
    if not all(g.get('rtk') is True for g in (g1, g2)):
        salida['motivo'] = 'GPS RTK no confirmado en ambas capturas.'
        return salida
    giro = abs((g2['yawGrados'] - g1['yawGrados'] + 180) % 360 - 180)
    salida['cambioYawGrados'] = giro
    if giro > 10:
        salida['motivo'] = 'Cambio de yaw mayor de 10°.'
        return salida
    # La imagen puede venir como función para no tener todas las bandas en memoria a la vez
    imagen = lambda c: c['imagen']() if callable(c['imagen']) else c['imagen']
    salida.update(desplazamiento_multiescala(imagen(a), imagen(b)))
    distancia, rumbo = distancia_y_rumbo(g1, g2)
    nominal = sum(gsd_para_captura(g, None)[0] for g in (g1, g2)) / 2
    salida.update(distanciaGpsM=distancia, gsdNominalM=nominal)
    modulo = salida['modulo']
    if modulo is None or modulo <= 0:
        return salida
    th = math.radians(rumbo - g1['yawGrados'])
    error = math.degrees(math.acos(np.clip((-math.sin(th) * salida['dx'] + math.cos(th) * salida['dy']) / modulo, -1, 1)))
    efectivo = distancia / modulo
    valido = salida['coincide'] and modulo >= 20 and distancia >= 1 and error <= 15
    salida.update(gsdEfectivoM=efectivo, razon=efectivo / nominal, errorAngularGrados=error, valido=valido)
    if not valido and salida['motivo'] is None:
        salida['motivo'] = 'Módulo menor de 20 px, distancia menor de 1 m o error angular mayor de 15°.'
    return salida


def gsd_efectivo_pares(capturas):
    """Devuelve pares y copias de capturas con la media de sus pares válidos.

    La entrada debe estar ordenada por hora; no se saltan vecinos inválidos.
    """
    pares = [_par(a, b) for a, b in zip(capturas, capturas[1:])]
    salida = []
    for i, captura in enumerate(capturas):
        vecinos = [pares[j]['gsdEfectivoM'] for j in (i - 1, i) if 0 <= j < len(pares) and pares[j]['valido']]
        salida.append({**captura, 'gsdEfectivoM': sum(vecinos) / len(vecinos) if vecinos else None})
    return {'pares': pares, 'capturas': salida}
