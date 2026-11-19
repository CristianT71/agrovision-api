"""Validación sintética de traslación y del contraste GPS, sin imágenes reales."""
from datetime import datetime
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

import numpy as np
import tifffile

from app import geo
from tests.test_escala import textura
from validacion.validar_escala import comparar, resumir, cargar_capturas


def test_comparar_gps_sentido_y_resumen():
    a = textura()
    g = geo.leer_geo({'RelativeAltitude': 70, 'CalibratedFocalLength': 2170,
                      'CalibratedOpticalCenterX': 256, 'CalibratedOpticalCenterY': 256,
                      'GpsLatitude': 4.7, 'GpsLongitude': -74.1, 'GimbalYawDegree': 0,
                      'GimbalPitchDegree': -90, 'GpsStatus': 'RTK'})
    for yaw in (0, 90, 180):
        g['yawGrados'] = yaw
        centro = geo.pixel_a_latlon(g, 256, 256 - 48, 70 / 2170)
        otra = dict(g, **centro)
        with patch('validacion.validar_escala.tifffile.imread', side_effect=[a, np.roll(a, 48, axis=0)]):
            p = comparar({'ruta': Path('a.tif'), 'geo': g}, {'ruta': Path('b.tif'), 'geo': otra})
        assert not p['descartado'] and p['sentidoCoincide'], p
        assert abs(p['razon'] - 1) < 0.01 and p['errorAngularGrados'] < 1, p
        assert resumir([p] * 8)['veredicto'].startswith('escala coherente')
        with patch('validacion.validar_escala.tifffile.imread', side_effect=[a, np.roll(a, -48, axis=0)]):
            invertido = comparar({'ruta': Path('a.tif'), 'geo': g}, {'ruta': Path('b.tif'), 'geo': otra})
        assert invertido['errorAngularGrados'] > 179 and not invertido['sentidoCoincide']
        assert resumir([invertido])['veredicto'].startswith('escala NO validada')
    assert resumir([])['razonMediana'] is None
    otra['rtk'] = None
    assert comparar({'ruta': Path('a'), 'geo': g}, {'ruta': Path('b'), 'geo': otra})['descartado']
    assert resumir([{'descartado': True}, p])['paresValidos'] == 1
    for razon, angulo, coherente in ((0.9, 10, True), (1.1, 10, True), (1.11, 0, False), (1, 15, True)):
        r = resumir([{'descartado': False, 'razon': razon, 'errorAngularGrados': angulo}] * 8)
        assert r['veredicto'].startswith('escala coherente') == coherente


def test_carga_nir_ordenada_por_hora():
    with TemporaryDirectory() as d:
        for nombre, banda, fecha in (('a', 'NIR', '2026:01:02 10:30:02'),
                                      ('b', 'NIR', '2026:01:02 10:30:01'),
                                      ('c', 'Red', '2026:01:02 10:30:00'), ('d', 'NIR', '')):
            xmp = f'<r BandName="{banda}" DateTimeOriginal="{fecha}"/>'.encode()
            tifffile.imwrite(Path(d) / f'{nombre}.tif', np.ones((32, 32), dtype=np.uint16),
                             extratags=[(700, 'B', len(xmp), xmp, False)])
        capturas, omitidas = cargar_capturas(Path(d))
        assert [c['ruta'].stem for c in capturas] == ['b', 'a']
        assert capturas[0]['fecha'] == datetime(2026, 1, 2, 10, 30, 1)
        assert len(omitidas) == 2


def test_veredicto_muestra_y_dispersion():
    def par(razon):
        return {'descartado': False, 'razon': razon, 'errorAngularGrados': 2.}
    assert resumir([par(1.)] * 7)['veredicto'].startswith('escala NO validada')
    variable = resumir([par(0.9), par(1.1)] * 4)
    assert variable['veredicto'].startswith('escala variable: usar GSD efectivo local')
    assert abs(variable['dispersionMAD'] - 0.1) < 1e-10
    assert variable['razonMin'] == 0.9 and variable['razonMax'] == 1.1
    assert variable['errorAngularMaximoGrados'] == 2.
