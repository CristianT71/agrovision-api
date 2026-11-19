"""Mapas de calor y foto RGB reducidos (lado largo ~448 px): el modelo de visión limita el tamaño de la petición."""
from __future__ import annotations

import base64
import io

import numpy as np
from PIL import Image

LADO = 448
# Escala rojo → amarillo → verde (la de los mapas de vigor habituales), de -0,2 a 1,0
_PUNTOS = np.array([0.0, 0.5, 1.0])
_COLORES = np.array([[165, 0, 38], [255, 255, 191], [0, 104, 55]], dtype=np.float32)
MIN_VALOR, MAX_VALOR = -0.2, 1.0


def _reducir(img: Image.Image) -> Image.Image:
    img = img.copy()
    img.thumbnail((LADO, LADO))
    return img


def _png64(img: Image.Image) -> str:
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return base64.b64encode(buf.getvalue()).decode("ascii")


def _jpg64(img: Image.Image) -> str:
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=80, optimize=True)
    return base64.b64encode(buf.getvalue()).decode("ascii")


def mapa_calor(idx: np.ndarray) -> str:
    t = np.clip((idx - MIN_VALOR) / (MAX_VALOR - MIN_VALOR), 0, 1)
    rgb = np.stack([np.interp(np.nan_to_num(t), _PUNTOS, _COLORES[:, c]) for c in range(3)], axis=-1)
    rgb[~np.isfinite(idx)] = (60, 60, 60)  # sin dato: gris oscuro
    return _png64(_reducir(Image.fromarray(rgb.astype(np.uint8))))


def foto_rgb(ruta: str) -> str:
    with Image.open(ruta) as img:
        return _jpg64(_reducir(img.convert("RGB")))
