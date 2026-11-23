"""Mosaico aproximado: geometría con capturas sintéticas de posición conocida."""
import math

import numpy as np

from app import geo, mosaico

LAT, LON = 1.89, -76.09
M_LAT = 111320.0
M_LON = 111320.0 * math.cos(math.radians(LAT))


def _geo(norte_m=0.0, este_m=0.0, yaw=0.0):
    return dict(lat=LAT + norte_m / M_LAT, lon=LON + este_m / M_LON, cx=50.0, cy=40.0, yawGrados=yaw,
                pitchGrados=-90.0, alturaRelativaM=30.0, focalPx=2000.0, georreferenciable=True)


def _item(valor, norte_m=0.0, este_m=0.0, yaw=0.0, gsd=0.1, ancho=100, alto=80, factor=1):
    return dict(geo=_geo(norte_m, este_m, yaw), gsd=gsd, ancho=ancho, alto=alto, factor=factor,
                valores=np.full((alto // factor, ancho // factor), valor, dtype=np.float32))


def _armar(items, res=0.1):
    ref = mosaico.referencia(items)
    lim = mosaico.limites(items, ref)
    return mosaico.construir(items, ref, lim, res), ref, lim


def test_una_captura_cubre_su_huella_con_su_valor():
    m, _, lim = _armar([_item(0.7)])
    assert abs((lim[2] - lim[0]) - 10.0) < 0.2 and abs((lim[3] - lim[1]) - 8.0) < 0.2  # 100x80 px a 0,1 m
    centro = m['valores'][m['alto'] // 2, m['ancho'] // 2]
    assert abs(centro - 0.7) < 1e-3 and m['coberturaPct'] > 95


def test_dos_capturas_contiguas_al_este_se_colocan_a_la_derecha():
    a, b = _item(0.2, este_m=0.0), _item(0.9, este_m=10.0)  # una huella de ancho de separación
    m, _, lim = _armar([a, b])
    assert abs((lim[2] - lim[0]) - 20.0) < 0.3
    fila = m['valores'][m['alto'] // 2]
    assert abs(fila[int(m['ancho'] * 0.15)] - 0.2) < 0.05 and abs(fila[int(m['ancho'] * 0.85)] - 0.9) < 0.05


def test_el_norte_queda_arriba():
    sur, norte = _item(0.1, norte_m=0.0), _item(0.8, norte_m=8.0)
    m, _, _ = _armar([sur, norte])
    col = m['valores'][:, m['ancho'] // 2]
    assert abs(col[int(m['alto'] * 0.15)] - 0.8) < 0.05 and abs(col[int(m['alto'] * 0.85)] - 0.1) < 0.05


def test_solape_promedia_y_es_estable():
    a, b = _item(0.4, este_m=0.0), _item(0.6, este_m=5.0)  # se solapan a la mitad
    m, _, _ = _armar([a, b])
    medio = m['valores'][m['alto'] // 2, m['ancho'] // 2]
    assert 0.4 <= medio <= 0.6


def test_captura_rotada_90_grados_ocupa_la_caja_girada():
    m, _, lim = _armar([_item(0.5, yaw=90.0)])
    assert abs((lim[2] - lim[0]) - 8.0) < 0.2 and abs((lim[3] - lim[1]) - 10.0) < 0.2  # ancho y alto intercambiados


def test_captura_reducida_conserva_geometria():
    grande, _, lim_g = _armar([_item(0.5)])
    reducida, _, lim_r = _armar([_item(0.5, factor=4)])
    assert abs(lim_g[2] - lim_r[2]) < 0.05 and abs(lim_g[3] - lim_r[3]) < 0.05
    assert abs(np.nanmean(reducida['valores']) - 0.5) < 1e-3


def test_nan_se_queda_sin_dato_y_no_contamina():
    it = _item(0.5)
    it['valores'][:, :50] = np.nan
    m, _, _ = _armar([it])
    fila = m['valores'][m['alto'] // 2]
    assert np.isnan(fila[int(m['ancho'] * 0.1)]) and abs(fila[int(m['ancho'] * 0.9)] - 0.5) < 1e-3


def test_ubicacion_geografica_del_lienzo_es_consistente():
    m, ref, _ = _armar([_item(0.5)])
    # el centro de la captura (cx, cy) debe caer en el píxel que dice el origen geográfico
    px = (LON - m['origenLon']) * m['kx'] / m['resM']
    py = (m['origenLat'] - LAT) * m['ky'] / m['resM']
    assert abs(px - m['ancho'] / 2) < 6 and abs(py - m['alto'] / 2) < 6  # el centro de imagen (50,40) ~ centro del lienzo


def test_resolucion_respeta_el_ancho_maximo_y_la_minima():
    assert abs(mosaico.resolucion_lienzo((0, 0, 100, 50), 1000) - 0.1) < 1e-9
    assert mosaico.resolucion_lienzo((0, 0, 10, 10), 1000) == mosaico.RESOLUCION_MINIMA_M


def test_reducir_promedia_bloques_y_omite_nan():
    a = np.arange(16, dtype=np.float32).reshape(4, 4)
    r = mosaico.reducir(a, 2)
    assert r.shape == (2, 2) and abs(r[0, 0] - 2.5) < 1e-6
    a[0, 0] = np.nan
    assert abs(mosaico.reducir(a, 2)[0, 0] - (1 + 4 + 5) / 3) < 1e-6


def test_repartir_uniforme_incluye_extremos_y_no_repite():
    from app.main import repartir_uniforme
    assert repartir_uniforme(28, 4) == [0, 9, 18, 27]
    assert repartir_uniforme(3, 4) == [0, 1, 2]
    assert repartir_uniforme(10, 1) == [0]
    assert repartir_uniforme(0, 4) == []
