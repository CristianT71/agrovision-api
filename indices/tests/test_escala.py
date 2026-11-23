"""Pruebas sintéticas de GSD local, sin pytest ni TIFF reales."""
import math
from unittest.mock import patch
import numpy as np
from app import escala, geo, ficha


def textura():
    ruido = np.random.default_rng(730).normal(size=(512, 512))
    f = np.fft.fftfreq(512)
    return np.fft.ifft2(np.fft.fft2(ruido) * np.exp(-300 * (f[:, None] ** 2 + f[None, :] ** 2))).real


def desplazar(imagen, dx, dy):
    f = np.fft.fftfreq(imagen.shape[0])[:, None] * dy + np.fft.fftfreq(imagen.shape[1])[None, :] * dx
    return np.fft.ifft2(np.fft.fft2(imagen) * np.exp(-2j * np.pi * f)).real


def captura(i, metros=0, yaw=0):
    g = geo.leer_geo({'RelativeAltitude': 40, 'CalibratedFocalLength': 1000,
                     'CalibratedOpticalCenterX': 256, 'CalibratedOpticalCenterY': 256,
                     'GpsLatitude': math.degrees(metros / 6371000), 'GpsLongitude': 0,
                     'FlightYawDegree': yaw, 'GimbalPitchDegree': -90, 'GpsStatus': 'RTK'})
    return {'id': str(i), 'geo': g, 'imagen': np.roll(textura(), i * 48, axis=0)}


def test_desplazamiento_entero_y_subpixel():
    a = textura()
    for dx, dy in ((32, 48), (-40, 32), (32.6, 48.4), (-40.5, -32.25)):
        r = escala.desplazamiento_multiescala(a, desplazar(a, dx, dy))
        assert r['coincide'], r
        assert abs(r['dx'] - dx) < 0.8 and abs(r['dy'] - dy) < 0.8, r
        assert abs(r['modulo'] - math.hypot(dx, dy)) < 0.8


def test_ruido_dimensiones_y_no_finitos():
    a = textura()
    for b in (np.random.default_rng(123).normal(size=a.shape), np.ones_like(a), a[:32], a * np.nan):
        r = escala.desplazamiento_multiescala(a, b)
        assert not r['coincide'] and r['motivo'], r
    assert not escala.desplazamiento_multiescala(a[:32], a[:32])['coincide']


def test_escalas_discordantes():
    with patch('app.escala._correlacion', side_effect=[{'dx': 40, 'dy': 0, 'modulo': m} for m in (35, 40, 45)]):
        assert not escala.desplazamiento_multiescala(textura(), textura())['coincide']


def test_gps_media_vecinos_y_respaldo():
    capturas = [captura(0), captura(1, 1.44), captura(2, 3.36), captura(3, 5, yaw=20)]
    r = escala.gsd_efectivo_pares(capturas)
    p, q, giro = r['pares']
    assert p['valido'] and q['valido'] and not giro['valido'], r['pares']
    assert abs(p['distanciaGpsM'] - 1.44) < 1e-9
    assert abs(p['gsdEfectivoM'] - 0.03) < 0.0001
    assert abs(q['gsdEfectivoM'] - 0.04) < 0.0001
    assert r['capturas'][1]['gsdEfectivoM'] == (p['gsdEfectivoM'] + q['gsdEfectivoM']) / 2
    assert r['capturas'][3]['gsdEfectivoM'] is None
    assert escala.gsd_para_captura(capturas[3]['geo'], None) == (0.04, 'nominal')
    assert escala.gsd_para_captura({}, None) == (None, None)
    assert escala.gsd_para_captura({}, 0.03) == (0.03, 'efectivo')
    assert 'gsdEfectivoM' not in capturas[0]


def test_rechazos_rtk_cenital_distancia_sentido():
    a, b = captura(0), captura(1, 1.44)
    for campo, valor in (('rtk', None), ('georreferenciable', False)):
        mala = {**b, 'geo': {**b['geo'], campo: valor}}
        assert not escala.gsd_efectivo_pares([a, mala])['pares'][0]['valido']
    for b in (captura(1, 0.9), captura(1, -1.44)):
        assert not escala.gsd_efectivo_pares([a, b])['pares'][0]['valido']
    a['geo']['yawGrados'] = 359
    b = captura(1, 1.44, 1)
    assert escala.gsd_efectivo_pares([a, b])['pares'][0]['valido']


def test_ficha_gsd_usado_nominal_y_efectivo():
    base = {'sensor': None, 'resolucionPx': None, 'alturaRelativaM': None,
            'fecha': None, 'georreferencia': False}
    capturas = [{**captura(i), 'gsdEfectivoM': efectivo, 'metadatos': [base],
                 'bandas': ['nir'], 'calibrada': False} for i, efectivo in enumerate((0.03, None))]
    r = ficha.resumir(capturas, [{'valido': True, 'razon': 0.75}])
    assert r['gsdCmPx'] == {'min': 3., 'max': 4., 'media': 3.5}
    assert r['gsdNominalCmPx']['media'] == 4.
    assert r['gsdEfectivoCmPx'] == {'min': 3., 'max': 3., 'media': 3., 'capturasConEfectivo': 1}
    assert r['razonEfectivoNominal']['mediana'] == 0.75
    assert r['paresValidos'] == r['paresTotales'] == 1


def test_integracion_orden_gsd_local_y_proyeccion():
    from datetime import datetime, timedelta
    from pathlib import Path
    from tempfile import TemporaryDirectory
    from app import main
    capturas = [captura(0), captura(1, 1.44), captura(2, 3.36)]
    metadatos = {}
    for i, c in enumerate(capturas):
        metadatos[str(i)] = {'geo': c['geo'], 'fecha': datetime(2026, 1, 1) + timedelta(seconds=i),
                            'sensor': None, 'resolucionPx': (512, 512), 'alturaRelativaM': 40,
                            'georreferencia': True}
    def leer_banda(vuelo, archivo):
        i, banda = archivo.split('-')
        imagen = capturas[int(i)]['imagen'] + 10
        return (imagen if banda == 'nir' else imagen * 2), True
    with TemporaryDirectory() as d:
        raiz = Path(d)
        vuelo = '00000000-0000-0000-0000-000000000001'
        (raiz / vuelo).mkdir()
        peticion = main.Peticion(vueloId=vuelo, capturas=[main.Captura(
            id=str(i), bandas={b: f'{i}-{b}' for b in main.BANDAS}) for i in (2, 0, 1)])
        with patch.object(main, 'RAIZ', raiz), patch.object(main, 'leer_banda', side_effect=leer_banda) as lectura, \
             patch.object(main, 'ruta_archivo', side_effect=lambda v, a: a), \
             patch.object(main.ficha, 'leer', side_effect=lambda a: metadatos[a.split('-')[0]]), \
             patch.object(main.imagenes, 'mapa_calor', return_value=''), \
             patch.object(main.modulo_zonas, 'fusionar', side_effect=lambda zs: list(zs)):  # aquí se prueba la proyección por captura
            r = main.analizar(peticion)
        assert lectura.call_count == 12  # Una lectura de cada banda por captura.
    assert r['ficha']['paresValidos'] == r['ficha']['paresTotales'] == 2
    assert r['ficha']['gsdEfectivoCmPx']['capturasConEfectivo'] == 3
    assert abs(r['ficha']['gsdCmPx']['media'] - 3.5) < 0.01
    assert any('terreno ascendente' in a for a in r['advertencias'])
    assert not any('Hay capturas con GSD nominal' in a for a in r['advertencias'])
    resultado = escala.gsd_efectivo_pares(capturas)
    for z in r['zonasCandidatas']:
        i = int(z['capturaId'])
        gsd = resultado['capturas'][i]['gsdEfectivoM']
        assert z['gsdOrigen'] == 'efectivo'
        assert abs(z['areaM2'] - (504 * gsd) ** 2) < 0.1
        esperado = geo.pixel_a_latlon(capturas[i]['geo'], 252, 252, gsd)
        assert abs(z['ubicacionZona']['lat'] - esperado['lat']) < 1e-8
        assert len(z['poligono']) == 4


def test_limites_de_aceptacion_del_par():
    a, b = captura(0), captura(1, 1.44)
    for modulo, angulo, coincide, valido in ((19.9, 0, True, False), (20, 0, True, True),
                                            (48, 14.9, True, True), (48, 15.1, True, False),
                                            (48, 0, False, False)):
        medida = {'modulo': modulo, 'dx': modulo * math.sin(math.radians(angulo)),
                  'dy': modulo * math.cos(math.radians(angulo)), 'coincide': coincide,
                  'desplazamientos': {}, 'motivo': None}
        with patch('app.escala.desplazamiento_multiescala', return_value=medida):
            assert escala.gsd_efectivo_pares([a, b])['pares'][0]['valido'] == valido
    for giro, valido in ((10, True), (10.1, False)):
        b['geo']['yawGrados'] = giro
        with patch('app.escala.desplazamiento_multiescala', return_value={**medida, 'coincide': True}):
            assert escala.gsd_efectivo_pares([a, b])['pares'][0]['valido'] == valido


def test_gsd_supuesto_sin_focal():
    # Imagen reducida a 320 px a 80 m: se supone el campo de visión de la Mavic 3M.
    assert math.isclose(escala.gsd_supuesto({'alturaRelativaM': 80}, 320), 80 / (2170 / 2592 * 320))
    assert math.isclose(escala.gsd_supuesto({'alturaRelativaM': 70}, 2592), 70 / 2170)
    assert escala.gsd_supuesto({}, 320) is None
    assert escala.gsd_supuesto({'alturaRelativaM': 0}, 320) is None
    assert escala.gsd_supuesto({'alturaRelativaM': 80}, 0) is None
