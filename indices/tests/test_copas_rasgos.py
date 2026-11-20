"""Rasgos, clasificación optativa y exploración: solo escenas sintéticas."""
import json
import numpy as np
from app.copas import PARAMETROS, _forma, _rasgos, detectar_copas
from validacion.explorar_copas import analizar, separar, recorte_argumento


def test_forma_y_radiometria_medidas():
    region = np.ones((10, 10), bool)
    solidez, excentricidad = _forma(region)
    assert solidez == 1 and excentricidad == 0
    nir = np.tile([1., 3.], (20, 10))
    rasgos = _rasgos(region, nir, np.full_like(nir, .7), np.full(region.shape, .2), 2, 0, 0)
    assert abs(rasgos['texturaNir']-.5) < 1e-12  # El promedio por bloque borraría esta textura.
    assert abs(rasgos['ndviMedio']-.7) < 1e-12
    assert abs(rasgos['contrasteMedio']-.2) < 1e-12
    region[3:, 3:] = False
    assert _forma(region)[0] < .8
    vacio = _rasgos(np.zeros((2, 2), bool), nir, nir, nir[:2, :2], 1, 0, 0)
    assert all(v is None for v in vacio.values())
    assert _rasgos(np.ones((2, 2), bool), np.zeros((2, 2)), nir,
                   nir[:2, :2], 1, 0, 0)['texturaNir'] is None


def escena_mixta():
    y, x = np.indices((400, 520))
    pequena = (x-80)**2+(y-80)**2 < 15**2
    grande = (((x-330)**2+(y-230)**2 < 55**2)
              | ((x-380)**2+(y-230)**2 < 45**2)
              | ((x-330)**2+(y-280)**2 < 45**2))
    nir = .1 + pequena*.8 + grande*(.8+.45*((x+y)%2*2-1))
    return nir, np.full(nir.shape, .8)


def test_clasificacion_neutra_desactivada_y_masa():
    nir, ndvi = escena_mixta()
    base = detectar_copas(nir, ndvi, .02)
    prueba = dict(atipicaAreaMinM2=1., atipicaSolidezMax=.99, atipicaTexturaNirMin=.25)
    apagado = detectar_copas(nir, ndvi, .02, prueba)
    assert {k: v for k, v in base.items() if k != 'parametros'} == {
        k: v for k, v in apagado.items() if k != 'parametros'}
    neutro = detectar_copas(nir, ndvi, .02, {'clasificarAtipicas': True})
    assert neutro['atipicasConteo'] == 0 and neutro['conteo'] == base['conteo']
    activo = detectar_copas(nir, ndvi, .02, dict(clasificarAtipicas=True, **prueba))
    assert activo['atipicasConteo'] >= 1, activo
    assert activo['conteo'] == 1, activo
    assert activo['copas'][0]['x'] < 100
    assert activo['atipicasAreaM2'] == sum(c['areaRegionM2'] for c in activo['copasAtipicas'])
    assert abs(activo['areaAnalizadaM2'] - (520*.02-.4)*(400*.02-.4)) < 1e-10
    assert activo['densidadPlantasHa'] == activo['conteo']/activo['areaAnalizadaM2']*10000
    json.dumps(activo, allow_nan=False)


def test_maximos_antes_de_rechazo_por_valle():
    y, x = np.indices((200, 240))
    nir = .1 + np.exp(-((x-100)**2+(y-100)**2)/288) + np.exp(-((x-140)**2+(y-100)**2)/288)
    r = detectar_copas(nir, np.ones_like(nir), .02,
                       {'copaTipicaM': .4, 'valleMinimo': .8})
    assert r['conteo'] == 1, r
    assert r['copas'][0]['numeroMaximos'] == 2
    assert r['copas'][0]['areaRegionM2'] == r['copas'][0]['areaM2']


def test_auc_empates_sentidos_y_ausencias():
    assert separar([3, 4], [1, 2])['auc'] == 1
    assert separar([1, 2], [3, 4])['auc'] == 0
    assert separar([2, 2], [2, 2])['auc'] == .5
    resultado = separar(np.arange(10), np.arange(10))
    assert all(c['cMarcadas'] == 9 and c['abPerdidas'] == 9 for c in resultado['candidatos'])
    assert separar([], [1])['auc'] is None
    resumen = analizar({'A': [], 'B': [], 'C': [{'solidez': None}]})
    assert resumen['resumen']['C']['solidez']['n'] == 0
    assert resumen['separacionCvsAB']['solidez']['auc'] is None
    json.dumps(resumen, allow_nan=False)
    assert analizar({'libre': []})['separacionCvsAB'] == {}
    assert recorte_argumento('libre=0,1,20,30') == ('libre', (0, 1, 20, 30))


def test_png_atipicas_y_parametros_invalidos():
    from tempfile import TemporaryDirectory
    from pathlib import Path
    from PIL import Image
    from validacion.contar_copas import dibujar
    nir, ndvi = escena_mixta()
    r = detectar_copas(nir, ndvi, .02, dict(clasificarAtipicas=True, atipicaAreaMinM2=1.))
    assert r['copasAtipicas']
    with TemporaryDirectory() as carpeta:
        ruta = Path(carpeta)/'atipicas.png'
        dibujar(nir, r, .02, ruta)
        with Image.open(ruta) as imagen:
            a = np.asarray(imagen)
            assert np.any(np.all(a == [170, 170, 170], axis=2))
    for parametros in ({'clasificarAtipicas': 1}, {'atipicaAreaMinM2': float('inf')},
                       {'atipicaSolidezMax': 'malo'}, {'copaMinM': None}):
        try:
            detectar_copas(nir, ndvi, .02, parametros)
        except ValueError:
            pass
        else:
            assert False, parametros
    assert PARAMETROS['clasificarAtipicas'] is False


def test_explorador_cli_json_csv_y_contexto_unico():
    import contextlib
    import csv
    import io
    import sys
    from pathlib import Path
    from tempfile import TemporaryDirectory
    from unittest.mock import patch
    from validacion import explorar_copas as explorar
    nir, _ = escena_mixta()
    captura = dict(ruta=Path('nir.tif'), geo={'georreferenciable': True})
    with TemporaryDirectory() as carpeta:
        ruta = Path(carpeta)/'rasgos.csv'
        argumentos = ['explorar', 'vuelo', '--captura', '0', '--gsd-m', '.02',
                      '--recorte', 'A=0,0,160,160', '--recorte', 'B=160,0,260,160',
                      '--recorte', 'C=260,160,520,400', '--csv', str(ruta)]
        salida, errores = io.StringIO(), io.StringIO()
        with patch.object(sys, 'argv', argumentos), \
             patch('validacion.contar_copas.cargar_capturas', return_value=([captura], [])), \
             patch('validacion.contar_copas.buscar_roja', return_value=Path('roja.tif')), \
             patch('validacion.contar_copas.leer', side_effect=[nir, nir*.1]), \
             patch.object(explorar, 'detectar_copas', wraps=detectar_copas) as detector, \
             contextlib.redirect_stdout(salida), contextlib.redirect_stderr(errores):
            explorar.main()
        assert detector.call_count == 1
        resultado = json.loads(salida.getvalue())
        assert resultado['gsdM'] == .02 and resultado['recortes']['A']['conteo'] == 1
        assert 'no validación' in errores.getvalue()
        with ruta.open() as archivo:
            filas = list(csv.DictReader(archivo))
        assert len(filas) == sum(c['conteo'] for c in resultado['recortes'].values())
        assert 'texturaNir' in filas[0]
