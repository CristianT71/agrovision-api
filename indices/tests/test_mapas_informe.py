"""Mapas del informe: mapa de calor liviano (JPEG) y mapa de copas con círculos."""
import base64
import io

import numpy as np
from PIL import Image

from app import imagenes


def _decodificar(b64):
    return Image.open(io.BytesIO(base64.b64decode(b64)))


def test_mapa_calor_jpg_es_mas_liviano_que_png_y_conserva_el_tamano():
    rng = np.random.default_rng(1)
    idx = np.clip(rng.normal(0.6, 0.2, (600, 800)), -0.2, 1.0).astype(np.float32)
    png, jpg = imagenes.mapa_calor(idx), imagenes.mapa_calor(idx, "jpg")
    assert _decodificar(png).format == "PNG" and _decodificar(jpg).format == "JPEG"
    assert _decodificar(png).size == _decodificar(jpg).size
    assert len(jpg) < len(png)


def test_mapa_calor_marca_gris_donde_no_hay_dato():
    idx = np.full((100, 100), 0.8, dtype=np.float32)
    idx[:, :50] = np.nan
    r, g, b = _decodificar(imagenes.mapa_calor(idx)).convert("RGB").getpixel((5, 50))
    assert abs(r - 60) <= 2 and abs(g - 60) <= 2 and abs(b - 60) <= 2


def test_mapa_copas_dibuja_circulos_y_respeta_el_ancho():
    nir = np.full((400, 600), 0.2, dtype=np.float32)
    copas = [{"x": 150, "y": 200, "diametroM": 1.0, "fusionada": False}, {"x": 400, "y": 200, "diametroM": 1.0, "fusionada": True}]
    sin = _decodificar(imagenes.mapa_copas(nir, [], 0.02, ancho=300)).convert("RGB")
    con = _decodificar(imagenes.mapa_copas(nir, copas, 0.02, ancho=300)).convert("RGB")
    assert con.size == (300, 200)
    assert np.abs(np.asarray(con, dtype=int) - np.asarray(sin, dtype=int)).sum() > 0  # algo se dibujó
    # el círculo verde (no fusionada) está cerca del radio esperado: 1 m / 0,02 m/px / 2 · 0,5 = 12,5 px
    verde = np.asarray(con)[:, :, 1].astype(int) - np.asarray(con)[:, :, 0].astype(int)
    ys, xs = np.nonzero(verde > 40)  # el JPEG atenúa el color
    assert ys.size > 0 and abs(xs.min() - (75 - 12.5)) <= 4


def test_mapa_copas_tolera_nir_con_nan_y_constante():
    nir = np.full((100, 100), np.nan, dtype=np.float32)
    assert _decodificar(imagenes.mapa_copas(nir, [], 0.02, ancho=80)).size[0] == 80
    nir[:] = 0.5
    assert _decodificar(imagenes.mapa_copas(nir, [], 0.02, ancho=80)).size[0] == 80
