"""Contrato añadido de plantas: GSD local, promedio y captura inclinada nula."""
from datetime import datetime, timedelta
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

import numpy as np


def test_plantas_integracion():
    from app import main
    vuelo = '00000000-0000-0000-0000-000000000001'
    referencias = [dict(georreferenciable=cenital, alturaRelativaM=30, focalPx=1500)
                   for cenital in (True, True, False)]
    metas = [dict(geo=g, fecha=datetime(2026, 1, 1)+timedelta(seconds=i))
             for i, g in enumerate(referencias)]
    resultados = [dict(conteo=2, areaAnalizadaM2=20, densidadPlantasHa=1000,
                       diametroCopaM=None, vecinoMasCercanoM=None, fusionadas=0, descartadasGrandes=0, masasGrandes=0, areaMasasGrandesM2=0),
                  dict(conteo=3, areaAnalizadaM2=10, densidadPlantasHa=3000,
                       diametroCopaM=None, vecinoMasCercanoM=None, fusionadas=1, descartadasGrandes=1, masasGrandes=1, areaMasasGrandesM2=5)]
    with TemporaryDirectory() as d:
        raiz = Path(d)
        (raiz/vuelo).mkdir()
        p = main.Peticion(vueloId=vuelo, siembra=main.Siembra(distSurcoM=2, distPlantaM=1),
                          capturas=[main.Captura(id=str(i), bandas={b: f'{i}-{b}' for b in main.BANDAS})
                                    for i in range(3)])
        with patch.object(main, 'RAIZ', raiz), \
             patch.object(main, 'ruta_archivo', side_effect=lambda v, a: a), \
             patch.object(main, 'leer_banda', return_value=(np.ones((48, 48)), True)), \
             patch.object(main.ficha, 'leer', side_effect=lambda a: metas[int(a.split('-')[0])]), \
             patch.object(main.ficha, 'resumir', return_value={}), \
             patch.object(main.imagenes, 'mapa_calor', return_value=''), \
             patch.object(main.geo, 'poligono_de_celdas', return_value=None), \
             patch.object(main.escala, 'gsd_efectivo_pares', return_value={
                 'pares': [], 'capturas': [{'id': '0', 'gsdEfectivoM': .013}]}), \
             patch.object(main.copas, 'detectar_copas', side_effect=resultados) as detectar:
            r = main.analizar(p)
        assert detectar.call_count == 2
        assert [c.args[2] for c in detectar.call_args_list] == [.013, .02]
    plantas = r['plantas']
    assert plantas['densidadMediaPlantasHa'] == 2000
    assert plantas['diferenciaVsTeoricaPct'] == -60
    assert plantas['porCaptura'][2]['conteo'] is None
    assert plantas['porCaptura'][2]['densidadPlantasHa'] is None
    assert plantas['porCaptura'][0]['gsdOrigen'] == 'efectivo'
    assert plantas['porCaptura'][1]['gsdOrigen'] == 'nominal'
    assert r['siembra']['plantasPorHaDetectada'] == 2000
    assert r['siembra']['diferenciaPct'] == -60
    assert r['siembra']['conteoReal'] is None
    assert plantas['validado'] is False and len(plantas['advertencias']) == 3
    assert plantas['porCaptura'][2]['motivoSinConteo'].startswith('sin ángulo del gimbal')
    assert plantas['capturasConConteo'] == 2 and plantas['fiabilidad'] == 'baja'

    assert plantas['porCaptura'][1]['masasGrandes'] == 1
    assert plantas['porCaptura'][1]['areaMasasGrandesM2'] == 5
    assert plantas['porCaptura'][2]['masasGrandes'] is None
    assert plantas['porCaptura'][2]['areaMasasGrandesM2'] is None


def test_plantas_sin_focal_usa_gsd_supuesto_y_explica_inclinadas():
    """Vuelo sin focal calibrada (p. ej. imágenes reducidas): conteo aproximado con GSD supuesto."""
    from app import main, escala
    vuelo = '00000000-0000-0000-0000-000000000002'
    referencias = [dict(georreferenciable=False, alturaRelativaM=80, focalPx=None, pitchGrados=-90.0),
                   dict(georreferenciable=False, alturaRelativaM=70, focalPx=2170, pitchGrados=-45.0)]
    metas = [dict(geo=g, fecha=None) for g in referencias]
    resultado = dict(conteo=7, areaAnalizadaM2=500, densidadPlantasHa=140, diametroCopaM=None, vecinoMasCercanoM=None,
                     fusionadas=0, descartadasGrandes=0, masasGrandes=0, areaMasasGrandesM2=0)
    with TemporaryDirectory() as d:
        raiz = Path(d)
        (raiz/vuelo).mkdir()
        p = main.Peticion(vueloId=vuelo, capturas=[main.Captura(id=str(i), bandas={b: f'{i}-{b}' for b in main.BANDAS})
                                                   for i in range(2)])
        with patch.object(main, 'RAIZ', raiz), \
             patch.object(main, 'ruta_archivo', side_effect=lambda v, a: a), \
             patch.object(main, 'leer_banda', return_value=(np.ones((48, 64)), True)), \
             patch.object(main.ficha, 'leer', side_effect=lambda a: metas[int(a.split('-')[0])]), \
             patch.object(main.ficha, 'resumir', return_value={}), \
             patch.object(main.imagenes, 'mapa_calor', return_value=''), \
             patch.object(main.imagenes, 'mapa_copas', return_value=''), \
             patch.object(main.copas, 'detectar_copas', return_value=resultado) as detectar:
            r = main.analizar(p)
    assert detectar.call_count == 1
    assert np.isclose(detectar.call_args.args[2], 80 / (escala.RELACION_FOCAL_SUPUESTA * 64))
    plantas = r['plantas']
    assert plantas['porCaptura'][0]['conteo'] == 7 and plantas['porCaptura'][0]['gsdOrigen'] == 'supuesto'
    assert plantas['porCaptura'][1]['conteo'] is None
    assert 'inclinada' in plantas['porCaptura'][1]['motivoSinConteo']
    assert plantas['fiabilidad'] == 'muy baja' and plantas['densidadMediaPlantasHa'] == 140
    assert any('supuso' in a for a in plantas['advertencias'])
    assert any(a.startswith('Captura 1: sin conteo (captura inclinada') for a in plantas['advertencias'])
