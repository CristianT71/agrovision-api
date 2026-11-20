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
    assert plantas['validado'] is False and len(plantas['advertencias']) == 2

    assert plantas['porCaptura'][1]['masasGrandes'] == 1
    assert plantas['porCaptura'][1]['areaMasasGrandesM2'] == 5
    assert plantas['porCaptura'][2]['masasGrandes'] is None
    assert plantas['porCaptura'][2]['areaMasasGrandesM2'] is None
