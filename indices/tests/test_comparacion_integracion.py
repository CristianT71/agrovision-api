"""Integración directa de handlers; no requiere cliente HTTP adicional."""
from unittest.mock import patch
import math


def test_endpoint_comparar_reutiliza_analisis():
    from app import main
    p = main.Peticion(vueloId='v', capturas=[main.Captura(id='c', bandas={'nir': 'n'})])
    analisis = dict(indices=[dict(nombre='NDVI', media=.5, mediana=.5)],
                    ficha={'georreferenciacion': {'capturasGeorreferenciables': 1}}, mapas=['imagen'])
    huella = dict(latMin=4, latMax=4.01, lonMin=-74, lonMax=-73.99)
    with patch.object(main, 'analizar_peticion', side_effect=lambda *a, **k: dict(analisis)) as analizar, \
         patch.object(main, 'huella_peticion', return_value=huella):
        r = main.comparar(main.PeticionComparacion(a=p, b=p, fechaA='2026-09-15', fechaB='2026-09-15'))
        assert analizar.call_count == 2
        assert all(c.kwargs == {'incluir_mapas': False} for c in analizar.call_args_list)
        assert r['comparable'] and r['indices']['NDVI']['deltaMedia'] == 0
        assert 'imagen' not in str(r) and 'mapas' not in r
    with patch.object(main, 'analizar_peticion', return_value={'mapas': ['original']}) as analizar:
        assert main.analizar(p) == {'mapas': ['original']}
        analizar.assert_called_once_with(p)
    assert '/comparar' in [ruta.path for ruta in main.app.routes]


def test_huella_prefiere_escala_y_extiende_encuadre():
    from app import main
    g = dict(lat=4, lon=-74, alturaRelativaM=30, focalPx=1500, cx=50, cy=25,
             yawGrados=0, pitchGrados=-90, georreferenciable=True)
    p = main.Peticion(vueloId='v', capturas=[main.Captura(id='a', bandas={'nir': 'a'})],
                     capturasEscala=[main.Captura(id='b', bandas={'nir': 'b'})])
    with patch.object(main, 'ruta_archivo', side_effect=lambda v, a: a), \
         patch.object(main.ficha, 'leer', return_value={'geo': g, 'resolucionPx': (100, 50)}) as leer:
        h = main.huella_peticion(p)
        leer.assert_called_once_with('b')
        assert math.isclose(h['latMax']-h['latMin'], 1/111320)
        assert math.isclose(h['lonMax']-h['lonMin'], 2/(111320*math.cos(math.radians(4))))
        p.capturasEscala = []
        main.huella_peticion(p)
        assert leer.call_args.args == ('a',)
    with patch.object(main, 'ruta_archivo', return_value='a'), \
         patch.object(main.ficha, 'leer', return_value={'geo': {'georreferenciable': False}}):
        assert main.huella_peticion(p) is None


def test_limites_comparacion():
    from app.main import PeticionComparacion
    from pydantic import ValidationError
    p = dict(vueloId='v', capturas=[dict(id='a', bandas={})])
    for cambio in ({'ruidoMinimo': -1}, {'ruidoMinimo': float('inf')},
                   {'b': dict(p, capturasEscala=[dict(id=str(i), bandas={}) for i in range(401)])}):
        try:
            PeticionComparacion(**dict(a=p, b=p, **{}) | cambio)
        except ValidationError:
            pass
        else:
            assert False, 'Debe validar límites por vuelo y ruido'


def test_script_agrupa_xmp_y_reparte_capturas():
    from pathlib import Path
    from tempfile import TemporaryDirectory
    from validacion import comparar_vuelos as script
    vuelo = '00000000-0000-0000-0000-000000000001'
    with TemporaryDirectory() as d:
        carpeta = Path(d)/vuelo
        carpeta.mkdir()
        campos = {}
        for i in range(7):
            for b in script.BANDAS:
                ruta = carpeta/f'{i}-{b}.tif'
                ruta.touch()
                campos[str(ruta)] = {'BandName': b.upper(), 'DateTimeOriginal': f'2026:09:15 12:00:0{i}'}
        with patch.object(script, 'RAIZ', Path(d)), \
             patch.object(script.calibracion, 'leer_xmp', side_effect=lambda r: str(r)), \
             patch.object(script.ficha, '_campos_xmp', side_effect=lambda r: campos[r]):
            p = script.cargar_peticion(vuelo)
        assert [c.id for c in p.capturas] == ['0-nir', '2-nir', '4-nir', '6-nir']
        assert len(p.capturasEscala) == 7
        assert all(set(c.bandas) == set(script.BANDAS) for c in p.capturas)
