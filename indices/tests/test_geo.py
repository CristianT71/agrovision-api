"""Pruebas puras de geometría, ejecutables sin pytest."""
import math

from app import geo


def campos(**cambios):
    return dict({'RelativeAltitude': '70', 'CalibratedFocalLength': '2170',
                 'CalibratedOpticalCenterX': '1296', 'CalibratedOpticalCenterY': '972',
                 'GpsLatitude': '4.7', 'GpsLongitude': '-74.1', 'GimbalYawDegree': '0',
                 'GimbalPitchDegree': '-89.9', 'GpsStatus': 'RTK'}, **cambios)


def test_gsd():
    assert math.isclose(geo.gsd_m_px(70, 2170), 0.03225806451612903)
    for altura, focal in ((None, 2170), (70, None), (0, 1), (1, 0), (-1, 1), (1, -1), ('nan', 1), (1, 'inf')):
        assert geo.gsd_m_px(altura, focal) is None


def test_centro_y_orientacion():
    for yaw, norte, este in ((0, 1, 0), (90, 0, 1), (180, -1, 0), (270, 0, -1)):
        g = geo.leer_geo(campos(FlightYawDegree=str(yaw)))
        assert geo.pixel_a_latlon(g, 1296, 972, 1) == {'lat': 4.7, 'lon': -74.1}
        p = geo.pixel_a_latlon(g, 1296, 872, 1)
        assert math.isclose((p['lat'] - 4.7) * 111320, norte * 100, abs_tol=1e-8)
        assert math.isclose((p['lon'] + 74.1) * 111320 * math.cos(math.radians(4.7)), este * 100, abs_tol=1e-8)
    g = geo.leer_geo(campos(FlightYawDegree='90'))
    assert geo.pixel_a_latlon(g, 1396, 972, 1)['lat'] < g['lat']


def test_ausentes_invalidos_y_cenital():
    vacio = geo.leer_geo({})
    assert all(v is None for k, v in vacio.items() if k != 'georreferenciable')
    assert not vacio['georreferenciable']
    assert geo.pixel_a_latlon(vacio, 0, 0, 1) is None
    for campo in ('RelativeAltitude', 'CalibratedFocalLength', 'CalibratedOpticalCenterX',
                  'CalibratedOpticalCenterY', 'GpsLatitude', 'GpsLongitude', 'GimbalYawDegree', 'GimbalPitchDegree'):
        c = campos()
        del c[campo]
        assert geo.pixel_a_latlon(geo.leer_geo(c), 0, 0, 1) is None
    for pitch, valido in ((-85, True), (-95, True), (-84.999, False), (-95.001, False), (0, False)):
        g = geo.leer_geo(campos(GimbalPitchDegree=str(pitch)))
        assert g['georreferenciable'] == valido
        assert (geo.pixel_a_latlon(g, 0, 0, 1) is not None) == valido
    for clave, valor in (('GpsLatitude', '90'), ('GpsLongitude', '181'), ('GimbalYawDegree', 'nan')):
        assert not geo.leer_geo(campos(**{clave: valor}))['georreferenciable']
    g = geo.leer_geo(campos(GimbalYawDegree='', FlightYawDegree='45', GpsStatus='GPS'))
    assert g['yawGrados'] == 45 and g['rtk'] is False
    assert geo.leer_geo(campos(FlightYawDegree='45'))['yawGrados'] == 45
    # El gimbal puede venir girado 180° respecto al rumbo real: manda el rumbo del dron
    assert geo.leer_geo(campos(GimbalYawDegree='-12', FlightYawDegree='168'))['yawGrados'] == 168
    assert geo.leer_geo(campos(GimbalYawDegree='30'))['yawGrados'] == 30
    assert geo.pixel_a_latlon(g, 0, 0, None) is None


def test_area_cuadrado_y_recorte():
    g = geo.leer_geo(campos())
    celdas = [(0, 0), (1, 0), (0, 1), (1, 1)]
    p = geo.poligono_de_celdas(celdas, (241, 241), g, 0.5)
    assert p['areaM2'] == 100 and len(p['poligono']) == 4
    assert p['ubicacionZona'] == geo.pixel_a_latlon(g, 10, 10, 0.5)
    p = geo.poligono_de_celdas(celdas, (241, 241), g, 0.5, (2, 3))
    assert p['areaM2'] == 600
    assert p['ubicacionZona'] == geo.pixel_a_latlon(g, 20, 30, 0.5)
    assert geo.poligono_de_celdas([], (240, 240), g, 1) is None
    assert geo.poligono_de_celdas(celdas, (2, 2), g, 1) is None
    assert geo.poligono_de_celdas(celdas, (240, 240), geo.leer_geo({}), 1) is None


def test_poligono_compacto_sin_modificar_casco():
    puntos = [[math.sin(i * math.pi / 12), math.cos(i * math.pi / 12)] for i in range(24)]
    compacto = geo.poligono_compacto(puntos)
    assert len(compacto) == 12 and len(puntos) == 24
    assert all(p in puntos for p in compacto)
    assert geo.poligono_compacto(puntos[:4]) == puntos[:4]
