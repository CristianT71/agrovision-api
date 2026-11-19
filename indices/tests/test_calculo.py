import numpy as np

from app import calculo


def test_savi_no_esta_disponible():
    assert "SAVI" not in calculo.FORMULAS


def test_ndvi_igual_que_antes():
    nir = np.array([[0.6]], dtype=np.float32)
    rojo = np.array([[0.2]], dtype=np.float32)
    assert abs(float(calculo.calcular("NDVI", nir, rojo)[0, 0]) - 0.5) < 1e-4


def test_clases_vigor_suman_100():
    v = np.array([0.1, 0.2, 0.4, 0.5, 0.7, 0.8], dtype=np.float32)
    r = calculo.clases_vigor([v], 0.3, 0.6)
    assert r["bajoPct"] == 33.3 and r["altoPct"] == 33.3
    assert abs(r["bajoPct"] + r["medioPct"] + r["altoPct"] - 100) < 0.2


def test_clases_vigor_sin_datos():
    assert calculo.clases_vigor([], 0.3, 0.6) is None


def test_cobertura():
    v = np.array([0.1, 0.5, 0.6, 0.9], dtype=np.float32)
    assert calculo.cobertura_vegetal([v], 0.4)["pct"] == 75.0


def test_densidad_teorica():
    assert calculo.densidad_teorica(2.0, 1.0) == 5000


def test_resumen_desviacion_cv_y_sin_datos():
    assert calculo.resumen([], 0.5) is None
    assert calculo.resumen([np.array([np.nan])], 0.5) is None
    r = calculo.resumen([np.array([0.2, 0.6, np.nan])], 0.5)
    assert r['desviacion'] == 0.2 and r['cv'] == 0.5
    assert calculo.resumen([np.array([-0.2, 0.2])], 0.5)['cv'] is None


def test_variabilidad_celdas_nan():
    assert calculo.variabilidad_espacial([]) == {'desviacion': None, 'celdasValidas': 0, 'nivel': None}
    idx = np.full((48, 48), np.nan)
    assert calculo.variabilidad_espacial([calculo.medias_celdas(idx)])['celdasValidas'] == 0
    idx[:2, :2] = 0.2
    idx[2:4, :2] = [[0.6, np.nan], [0.6, np.nan]]
    idx[4:6, :2] = [[0.9, np.nan], [np.nan, np.nan]]
    r = calculo.variabilidad_espacial([calculo.medias_celdas(idx)])
    assert r == {'desviacion': 0.2, 'celdasValidas': 2, 'nivel': 'alta'}
    assert calculo.medias_celdas(np.ones((2, 2))).size == 0
    assert calculo.variabilidad_espacial([np.array([0.3, 0.3])])['nivel'] == 'baja'
    assert calculo.variabilidad_espacial([np.array([0.2, 0.4])])['nivel'] == 'media'


def test_resumen_desviacion_cv_y_no_finitos():
    r = calculo.resumen([np.array([0.2, 0.6, np.nan, np.inf])], 0.5)
    assert r['media'] == 0.4 and r['desviacion'] == 0.2 and r['cv'] == 0.5
    assert r['mediana'] == 0.4 and r['areaBajoUmbralPct'] == 50
    assert calculo.resumen([np.array([-0.6, -0.2])], 0.5)['cv'] == 0.5


def test_resumen_sin_datos_o_media_cero():
    for muestras in ([], [np.array([])], [np.array([np.nan, np.inf])]):
        assert calculo.resumen(muestras, 0.5) is None
    for v in ([-1, 1], [1e-10, 2e-10]):
        assert calculo.resumen([np.array(v)], 0.5)['cv'] is None


def test_rejilla_nan_y_cobertura_minima():
    n = calculo.CELDAS
    idx = np.full((n * 2, n * 2), np.nan)
    idx[:2, :2] = [[0.2, 0.4], [np.nan, np.nan]]
    idx[:2, 2:4] = [[0.8, np.nan], [np.nan, np.inf]]
    medias = calculo.medias_celdas(idx)
    assert np.isfinite(medias).sum() == 1
    assert abs(medias[0, 0] - 0.3) < 1e-8
    assert np.isnan(medias[0, 1])
    assert calculo.variabilidad_espacial([medias]) == {'desviacion': 0.0, 'celdasValidas': 1, 'nivel': 'baja'}
    assert calculo.zonas_bajas(idx, 0.5) == []


def test_variabilidad_sin_datos():
    for rejillas in ([], [calculo.medias_celdas(np.full((48, 48), np.nan))],
                    [calculo.medias_celdas(np.ones((2, 2)))]):
        assert calculo.variabilidad_espacial(rejillas) == {'desviacion': None, 'celdasValidas': 0, 'nivel': None}
    assert calculo.zonas_bajas(np.full((48, 48), np.nan), 0.5) == []
    assert calculo.zonas_bajas(np.ones((2, 2)), 0.5) == []


def test_variabilidad_niveles_y_varias_capturas():
    for d, nivel in ((0.0, 'baja'), (0.079, 'baja'), (0.08, 'media'), (0.149, 'media'), (0.15, 'alta')):
        r = calculo.variabilidad_espacial([np.array([-d, np.nan]), np.array([d])])
        assert r == {'desviacion': d, 'celdasValidas': 2, 'nivel': nivel}


def test_zonas_conserva_rejilla():
    idx = np.ones((48, 48))
    idx[:2, :6] = 0.2
    zonas = calculo.zonas_bajas(idx, 0.5)
    assert len(zonas) == 1
    assert abs(zonas[0]['valor'] - 0.2) < 1e-8
    assert zonas[0]['areaPct'] == 3 / calculo.CELDAS ** 2 * 100
    assert set(zonas[0]['celdas']) == {(0, 0), (0, 1), (0, 2)}
    assert zonas[0]['cx'] == 1.5 / calculo.CELDAS
    assert zonas[0]['cy'] == 0.5 / calculo.CELDAS
