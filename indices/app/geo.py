"""Geometría local de capturas cenitales; funciones puras, sin lectura de archivos."""
from __future__ import annotations

import math

from .calculo import CELDAS

ADVERTENCIA = ('GSD y coordenadas por píxel suponen terreno plano y cámara vertical; '
               'la altura es relativa al punto de despegue, no al suelo.')


def _numero(valor):
    try:
        numero = float(valor)
        return numero if math.isfinite(numero) else None
    except (TypeError, ValueError):
        return None


def gsd_m_px(altura_relativa_m, focal_px):
    """Escala nominal en m/píxel; la altura relativa no equivale a altura sobre suelo."""
    altura, focal = _numero(altura_relativa_m), _numero(focal_px)
    return altura / focal if altura is not None and focal is not None and altura > 0 and focal > 0 else None


def leer_geo(campos_xmp):
    claves = {'lat': 'GpsLatitude', 'lon': 'GpsLongitude', 'alturaRelativaM': 'RelativeAltitude',
              'focalPx': 'CalibratedFocalLength', 'cx': 'CalibratedOpticalCenterX',
              'cy': 'CalibratedOpticalCenterY', 'yawGrados': 'FlightYawDegree',
              'pitchGrados': 'GimbalPitchDegree'}
    geo = {k: _numero(campos_xmp.get(v)) for k, v in claves.items()}
    # Se prefiere el rumbo del dron (FlightYawDegree): en un vuelo real el GimbalYawDegree saltó 180° entre
    # capturas contiguas aunque las imágenes y el rumbo de avance no giraron. El del gimbal solo es respaldo.
    if geo['yawGrados'] is None:
        geo['yawGrados'] = _numero(campos_xmp.get('GimbalYawDegree'))
    estado = campos_xmp.get('GpsStatus')
    geo['rtk'] = str(estado).strip().upper() == 'RTK' if estado is not None else None
    geo['georreferenciable'] = _valida(geo)
    return geo


def _valida(geo):
    campos = ('lat', 'lon', 'cx', 'cy', 'yawGrados', 'pitchGrados')
    return (all(_numero(geo.get(k)) is not None for k in campos)
            and -90 < geo['lat'] < 90 and -180 <= geo['lon'] <= 180
            and abs(geo['pitchGrados'] + 90) <= 5
            and gsd_m_px(geo.get('alturaRelativaM'), geo.get('focalPx')) is not None)


def pixel_a_latlon(geo, x, y, gsd):
    """Proyecta sobre terreno plano, en nadir y sin distorsión de lente.

    El error crece con la pendiente. La altura relativa al despegue puede diferir
    de la altura sobre el suelo. Aproximación local de 111320 m por grado.
    """
    if (not geo or not _valida(geo) or geo.get('georreferenciable') is False
            or _numero(gsd) is None or gsd <= 0 or _numero(x) is None or _numero(y) is None):
        return None
    dx, dy = (x - geo['cx']) * gsd, (geo['cy'] - y) * gsd
    psi = math.radians(geo['yawGrados'])
    este = dx * math.cos(psi) + dy * math.sin(psi)
    norte = -dx * math.sin(psi) + dy * math.cos(psi)
    return {'lat': geo['lat'] + norte / 111320,
            'lon': geo['lon'] + este / (111320 * math.cos(math.radians(geo['lat'])))}


def poligono_de_celdas(celdas, forma, geo, gsd, escala_xy=(1., 1.)):
    """Casco convexo sin cierre repetido, área y centroide del casco (no de la unión).

    escala_xy lleva la rejilla procesada a los píxeles originales de la cámara.
    Respeta el recorte entero de medias_celdas. Elimina puntos colineales para
    mantener compacta la respuesta sin alterar el casco convexo.
    """
    if not celdas or pixel_a_latlon(geo, 0, 0, gsd) is None:
        return None
    alto, ancho = forma
    h, w = alto // CELDAS, ancho // CELDAS
    if h < 1 or w < 1:
        return None
    sx, sy = escala_xy
    puntos = sorted({(x * w * sx, y * h * sy) for fila, col in celdas
                     for x, y in ((col, fila), (col + 1, fila),
                                  (col + 1, fila + 1), (col, fila + 1))})

    def cruz(a, b, c):
        return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])

    def mitad(puntos):
        salida = []
        for p in puntos:
            while len(salida) >= 2 and cruz(salida[-2], salida[-1], p) <= 0:
                salida.pop()
            salida.append(p)
        return salida

    casco = mitad(puntos)[:-1] + mitad(puntos[::-1])[:-1]
    dobles, sx, sy = 0, 0, 0
    for a, b in zip(casco, casco[1:] + casco[:1]):
        producto = a[0] * b[1] - b[0] * a[1]
        dobles += producto
        sx += (a[0] + b[0]) * producto
        sy += (a[1] + b[1]) * producto
    centro = pixel_a_latlon(geo, sx / (3 * dobles), sy / (3 * dobles), gsd)
    vertices = [pixel_a_latlon(geo, x, y, gsd) for x, y in casco]
    return {'poligono': [[p['lat'], p['lon']] for p in vertices],
            'areaM2': abs(dobles) / 2 * gsd ** 2, 'ubicacionZona': centro}


def poligono_compacto(poligono, max_vertices=12):
    """Reduce solo la representación: retira vértices de menor área triangular.

    Conserva convexidad y orden. El área y centroide deben seguir siendo los del
    casco exacto; la representación puede omitir pequeñas cuñas del perímetro.
    """
    puntos = list(poligono)
    while len(puntos) > max_vertices:
        def perdida(i):
            a, b, c = puntos[i - 1], puntos[i], puntos[(i + 1) % len(puntos)]
            return abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]))
        puntos.pop(min(range(len(puntos)), key=perdida))
    return puntos
