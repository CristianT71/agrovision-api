"""Pruebas invocables a mano, sin pytest ni TIFF reales del usuario."""
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

import numpy as np
import tifffile

from app import ficha, main


XMP = b'''<x:xmpmeta xmlns:x="adobe:ns:meta/" xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
 xmlns:tiff="http://ns.adobe.com/tiff/1.0/" xmlns:exif="http://ns.adobe.com/exif/1.0/"
 xmlns:drone-dji="http://www.dji.com/drone-dji/1.0/">
 <rdf:RDF><rdf:Description tiff:Model="M3M" drone-dji:RelativeAltitude="42.5"
 drone-dji:GpsLatitude="4.7" drone-dji:GpsLongitude="-74.1"
 exif:DateTimeOriginal="2026:01:02 10:30:00" drone-dji:BlackLevel="0"
 drone-dji:SensorGain="1" drone-dji:ExposureTime="1"
 drone-dji:SensorGainAdjustment="1" drone-dji:Irradiance="1"/></rdf:RDF></x:xmpmeta>'''


def test_ficha_tiff_xmp_y_ausentes():
    with TemporaryDirectory() as d:
        ruta = Path(d) / 'banda.tif'
        tifffile.imwrite(ruta, np.ones((48, 72), dtype=np.uint16), extratags=[(700, 'B', len(XMP), XMP, False)])
        m = ficha.leer(ruta)
        assert m['sensor'] == 'M3M' and m['resolucionPx'] == (72, 48)
        assert m['alturaRelativaM'] == 42.5 and m['georreferencia']
        assert m['fecha'].isoformat() == '2026-01-02T10:30:00'
        tifffile.imwrite(ruta, np.ones((48, 72), dtype=np.uint16))
        vacio = ficha.leer(ruta)
        assert vacio['sensor'] is None and vacio['alturaRelativaM'] is None
        assert vacio['fecha'] is None and not vacio['georreferencia']
        r = ficha.resumir([{'metadatos': [m, vacio], 'bandas': ['nir', 'red'], 'calibrada': False}])
        assert r['capturasConGeorreferencia'] == 1
        assert r['calibracion'] == {'calibradas': 0, 'sinCalibrar': 1}
        assert r['gsdCmPx'] is None and r['alturaRelativaM'] == {'min': 42.5, 'max': 42.5}
        json.dumps(r, allow_nan=False)


def test_ficha_exif_y_xmp_elementos():
    with TemporaryDirectory() as d:
        ruta = Path(d) / 'banda.tif'
        tifffile.imwrite(ruta, np.ones((24, 24), dtype=np.uint16), datetime='2025:02:03 04:05:06',
                         extratags=[(272, 's', 0, 'Camara de prueba', False)])
        m = ficha.leer(ruta)
        assert m['sensor'] == 'Camara de prueba'
        assert m['fecha'].isoformat() == '2025-02-03T04:05:06'
    assert ficha._campos_xmp('<r xmlns:d="urn:test"><d:RelativeAltitude>23</d:RelativeAltitude></r>')['RelativeAltitude'] == '23'
    assert ficha._campos_xmp('dañado') == {}
    assert ficha._numero('nan') is None and ficha._numero('inf') is None
    assert ficha._fecha('desconocida') is None
    assert abs(ficha._coordenada('74,6W') + 74.1) < 1e-8
    assert ficha._gps_exif((4, 1, 30, 1, 0, 1)) == 4.5


def test_analizar_ficha_solo_capturas_usadas():
    with TemporaryDirectory() as d:
        raiz = Path(d)
        vuelo = '00000000-0000-0000-0000-000000000001'
        (raiz / vuelo).mkdir()
        bandas = {}
        for i, b in enumerate(main.BANDAS, 1):
            archivo = f'00000000-0000-0000-0000-{i:012d}'
            bandas[b] = archivo
            tifffile.imwrite(raiz / vuelo / f'{archivo}.tif', np.full((48, 48), 3 if b == 'nir' else 1, dtype=np.uint16),
                             extratags=[(700, 'B', len(XMP), XMP, False)])
        peticion = main.Peticion(vueloId=vuelo, capturas=[main.Captura(id='omitida', bandas={}),
                                                       main.Captura(id='usada', bandas=bandas)])
        with patch.object(main, 'RAIZ', raiz):
            r = main.analizar(peticion)
        assert r['capturasUsadas'] == r['ficha']['capturasUsadas'] == 1
        assert r['ficha']['calibracion'] == {'calibradas': 1, 'sinCalibrar': 0}
        assert r['ficha']['capturasConGeorreferencia'] == 1
        assert r['variabilidadEspacial'] == {'desviacion': 0.0, 'celdasValidas': main.calculo.CELDAS ** 2, 'nivel': 'baja'}
        assert {i['nombre'] for i in r['indices']} == {'NDVI', 'NDRE', 'GNDVI'}
        assert all(i['desviacion'] == 0 and i['cv'] == 0 for i in r['indices'])
        json.dumps(r, allow_nan=False)
