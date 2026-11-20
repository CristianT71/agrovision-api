"""Casos sintéticos reproducibles; no sustituyen el conteo manual en campo."""
import json
import numpy as np
from app.copas import detectar_copas, motivo_sin_conteo, resumir_capturas


def escena(centros, sigma=10, forma=(320, 400), ruido=0.002):
    y, x = np.indices(forma)
    nir = np.full(forma, 0.1) + np.random.default_rng(4).normal(0, ruido, forma)
    for cy, cx in centros:
        nir += np.exp(-((x-cx)**2+(y-cy)**2)/(2*sigma**2))
    return nir, np.full(forma, 0.83)


def test_conteo_densidad_y_coordenadas():
    centros = [(80, 80), (80, 200), (220, 80), (220, 300)]
    r = detectar_copas(*escena(centros), 0.02)
    assert r['conteo'] == 4, r
    assert abs(r['areaAnalizadaM2'] - (8-0.4)*(6.4-0.4)) < 1e-9
    assert r['densidadPlantasHa'] == 4/r['areaAnalizadaM2']*10000
    assert r['diametroCopaM'] is not None and r['vecinoMasCercanoM'] is not None
    for y, x in centros:
        assert min(np.hypot(c['x']-x, c['y']-y) for c in r['copas']) < 3


def test_dos_copas_pegadas():
    # A 0,50 m hay valle claro y diámetro >= 0,4 m; proximidad marca ambas.
    # Antes sigma=3 aceptaba manchas menores que el diámetro mínimo.
    r = detectar_copas(*escena([(160, 180), (160, 205)], sigma=7), 0.02,
                       {'copaTipicaM': 0.4})
    assert r['conteo'] == 2 and r['fusionadas'] == 2, r


def test_arbol_enorme():
    r = detectar_copas(*escena([(160, 200)], sigma=65), 0.02)
    assert r['conteo'] == 0 and r['descartadasGrandes'] == 1, r


def test_ndvi_bajo_y_sin_vegetacion():
    nir, ndvi = escena([(80, 80), (220, 300)])
    ndvi[:160] = 0.1
    assert detectar_copas(nir, ndvi, 0.02)['conteo'] == 1
    r = detectar_copas(nir, np.zeros_like(ndvi), 0.02)
    assert r['conteo'] == 0 and r['densidadPlantasHa'] == 0
    assert detectar_copas(np.ones_like(nir), ndvi, 0.02)['conteo'] == 0


def test_nan_y_gsd_invalido():
    nir, ndvi = escena([(80, 80)])
    nir[0:30] = np.nan
    ndvi[-20:] = np.nan
    r = detectar_copas(nir, ndvi, 0.02)
    assert r['conteo'] == 1
    json.dumps(r, allow_nan=False)
    assert detectar_copas(nir*np.nan, ndvi, 0.02)['conteo'] == 0
    for gsd in (None, 0, -1, np.nan, np.inf):
        try:
            detectar_copas(nir, ndvi, gsd)
        except ValueError:
            pass
        else:
            assert False, 'Se esperaba ValueError por GSD inválido.'


def test_borde_y_promedio_capturas():
    assert detectar_copas(*escena([(160, 2)], sigma=4), 0.02)['conteo'] == 0
    datos = [{'capturaId': str(d), 'conteo': d and d // 100, 'densidadPlantasHa': d, 'gsdOrigen': 'nominal', 'gsdM': .03}
             for d in (1000, 3000, None)]
    r = resumir_capturas(datos, 4000)
    assert r['densidadMediaPlantasHa'] == 2000 and r['diferenciaVsTeoricaPct'] == -50
    assert len(r['advertencias']) == 2
    assert resumir_capturas(datos)['diferenciaVsTeoricaPct'] is None
    assert resumir_capturas([datos[-1]])['densidadMediaPlantasHa'] is None


def test_png_y_vecinas_de_validacion():
    from pathlib import Path
    from tempfile import TemporaryDirectory
    from datetime import datetime, timedelta
    from unittest.mock import patch
    from PIL import Image
    from validacion.contar_copas import dibujar, gsd_local
    nir, ndvi = escena([(80, 80)])
    resultado = detectar_copas(nir, ndvi, 0.02)
    with TemporaryDirectory() as d:
        ruta = Path(d)/'copas.png'
        dibujar(nir, resultado, 0.02, ruta)
        with Image.open(ruta) as imagen:
            assert imagen.format == 'PNG' and imagen.width <= 1300
    capturas = [dict(ruta=Path(str(i)), fecha=datetime(2026, 1, 1)+timedelta(seconds=i),
                     geo=dict(georreferenciable=True, alturaRelativaM=30, focalPx=1500))
                for i in range(4)]
    capturas[2]['fecha'] = capturas[1]['fecha']
    def pares(vecinas):
        assert [c['id'] for c in vecinas] == ['0', '1', '2']
        assert not vecinas[1]['geo']['georreferenciable']
        assert not vecinas[2]['geo']['georreferenciable']
        return {'capturas': [{**c, 'gsdEfectivoM': None} for c in vecinas]}
    with patch('validacion.contar_copas.escala.gsd_efectivo_pares', side_effect=pares):
        assert gsd_local(capturas, 1) == (0.02, 'nominal')


def test_contraste_local_tenue_y_brillante():
    y, x = np.indices((320, 480))
    fondo = np.where(x < 240, 0.1, 0.5)
    tenue = 0.12*np.exp(-((x-100)**2+(y-160)**2)/200)
    brillante = 1.2*np.exp(-((x-370)**2+(y-160)**2)/200)
    # Ambas pasan por contraste respecto a su fondo, pese al brillo desigual.
    r = detectar_copas(fondo+tenue+brillante, np.ones_like(fondo), .02)
    assert r['conteo'] == 2, r
    # Una señal local insuficiente no se rescata bajando el umbral.
    r = detectar_copas(fondo+tenue*.05+brillante, np.ones_like(fondo), .02)
    assert r['conteo'] == 1, r


def test_copa_grande_sin_valle_no_fusionada():
    r = detectar_copas(*escena([(160, 200)], sigma=40, ruido=0), .02)
    assert r['conteo'] == 1 and r['fusionadas'] == 0, r
    assert 1.6 < r['copas'][0]['diametroM'] < 2.5, r


def test_masa_area_excluida_y_textura_sin_valle():
    nir, ndvi = escena([(160, 200)], sigma=80, ruido=0)
    y, x = np.indices(nir.shape)
    nir += .015*np.cos(x/8)*np.cos(y/8)
    r = detectar_copas(nir, ndvi, .02)
    assert r['conteo'] == 0 and r['masasGrandes'] == 1, r
    assert r['areaMasasGrandesM2'] > 0
    assert abs(r['areaAnalizadaM2']+r['areaMasasGrandesM2']-45.6) < 1e-8
    assert r['densidadPlantasHa'] == 0


def test_pasto_pequeno_y_diametro_medido():
    nir, ndvi = escena([(160, 200)], sigma=3, ruido=0)
    assert detectar_copas(.1+(nir-.1)*.03, ndvi, .02)['conteo'] == 0
    # También se descarta una mancha pequeña aunque sea brillante.
    assert detectar_copas(nir, ndvi, .02, {'copaTipicaM': .2})['conteo'] == 0
    r = detectar_copas(*escena([(160, 200)], sigma=10, ruido=0), .02)
    # Ancho a media altura del gaussiano suavizado: no el área del pasto vecino.
    esperado = 2*np.sqrt(2*np.log(2))*np.sqrt(10**2+10**2)*.02
    assert abs(r['copas'][0]['diametroM']-esperado) < .09


def test_recorte_coordenadas_area_y_png():
    from pathlib import Path
    from tempfile import TemporaryDirectory
    from PIL import Image
    from validacion.contar_copas import dibujar
    nir, ndvi = escena([(80, 80), (220, 300)], ruido=0)
    r = detectar_copas(nir, ndvi, .02, recorte=(50, 40, 150, 160))
    assert r['conteo'] == 1 and 75 < r['copas'][0]['x'] < 85
    assert r['areaRecorteM2'] == r['areaAnalizadaM2'] == 4.8
    with TemporaryDirectory() as d:
        ruta = Path(d)/'recorte.png'
        dibujar(nir, r, .02, ruta)
        with Image.open(ruta) as imagen:
            assert imagen.size == (100, 120)
    for recorte in ((0, 0, 401, 320), (2, 0, 1, 30), (0, 1, 2)):
        try:
            detectar_copas(nir, ndvi, .02, recorte=recorte)
        except ValueError:
            pass
        else:
            assert False


def test_masa_meseta_y_area_parcial_recorte():
    y, x = np.indices((400, 500))
    nir = .1+.8*((x-250)**2+(y-200)**2 < 80**2)
    nir += .005*np.cos(x/7)*np.cos(y/7)
    ndvi = np.ones_like(nir)
    completo = detectar_copas(nir, ndvi, .02)
    assert completo['masasGrandes'] == 1 and completo['conteo'] == 0
    recorte = detectar_copas(nir, ndvi, .02, recorte=(250, 0, 500, 400))
    assert recorte['conteo'] == 0
    assert abs(recorte['areaMasasGrandesM2']/completo['areaMasasGrandesM2']-.5) < .03
    assert abs(recorte['areaAnalizadaM2']+recorte['areaMasasGrandesM2']-40) < 1e-8


def test_valle_en_region_brillante_compartida():
    # Separación de 0,8 m: fuera de la regla del vecino cercano.
    # Valle ~30%, pero sobre media altura: fusionadas por máximos internos.
    r = detectar_copas(*escena([(160, 180), (160, 220)], sigma=12, ruido=0),
                       .02, {'copaTipicaM': .4})
    assert r['conteo'] == 2 and r['fusionadas'] == 2, r


def test_conteo_degradado_con_motivo_y_gsd_supuesto():
    cenital = dict(pitchGrados=-89.9, georreferenciable=False)
    assert motivo_sin_conteo(cenital, 0.03) is None  # sin focal ni centro óptico, pero cenital: se cuenta
    assert 'escala' in motivo_sin_conteo(cenital, None)
    assert 'inclinada' in motivo_sin_conteo(dict(pitchGrados=-45), 0.03)
    assert motivo_sin_conteo(dict(georreferenciable=True), 0.03) is None
    assert 'cenital' in motivo_sin_conteo(dict(georreferenciable=False), 0.03)
    r = resumir_capturas([
        dict(capturaId='a', conteo=6, densidadPlantasHa=9, gsdOrigen='supuesto', gsdM=.3, motivoSinConteo=None),
        dict(capturaId='b', conteo=None, densidadPlantasHa=None, gsdOrigen='nominal', gsdM=.03,
             motivoSinConteo='captura inclinada (-45°): la escala cambia dentro de la imagen')], 5000)
    assert r['capturasConConteo'] == 1 and r['fiabilidad'] == 'muy baja'
    texto = ' '.join(r['advertencias'])
    assert 'supuso' in texto and 'subestima' in texto and 'Captura b: sin conteo (captura inclinada' in texto
    vacio = resumir_capturas([dict(capturaId='c', conteo=None, densidadPlantasHa=None, gsdOrigen=None, gsdM=None,
                                   motivoSinConteo='sin altura relativa ni focal en los metadatos: no hay escala para medir copas')])
    assert vacio['fiabilidad'] is None and vacio['capturasConConteo'] == 0
    assert any('ninguna captura' in a for a in vacio['advertencias'])
    assert any('Captura c: sin conteo (sin altura' in a for a in vacio['advertencias'])
