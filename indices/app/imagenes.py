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


def _reducir(img: Image.Image, lado: int = LADO) -> Image.Image:
    img = img.copy()
    img.thumbnail((lado, lado))
    return img


def _png64(img: Image.Image) -> str:
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return base64.b64encode(buf.getvalue()).decode("ascii")


def _jpg64(img: Image.Image) -> str:
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=80, optimize=True)
    return base64.b64encode(buf.getvalue()).decode("ascii")


def mapa_calor(idx: np.ndarray, formato: str = "png", lado: int = LADO) -> str:
    """Mapa de calor del índice. PNG para el modelo de visión; JPEG (mucho más liviano) para el informe."""
    t = np.clip((idx - MIN_VALOR) / (MAX_VALOR - MIN_VALOR), 0, 1)
    rgb = np.stack([np.interp(np.nan_to_num(t), _PUNTOS, _COLORES[:, c]) for c in range(3)], axis=-1)
    rgb[~np.isfinite(idx)] = (60, 60, 60)  # sin dato: gris oscuro
    imagen = _reducir(Image.fromarray(rgb.astype(np.uint8)), lado)
    return _jpg64(imagen) if formato == "jpg" else _png64(imagen)


def foto_rgb(ruta: str) -> str:
    with Image.open(ruta) as img:
        return _jpg64(_reducir(img.convert("RGB")))


def mapa_copas(nir: np.ndarray, copas_detectadas: list[dict], gsd_m: float, ancho: int = 640) -> str:
    """NIR en gris con un círculo por copa detectada (diámetro estimado). Es una verificación visual, no un dato."""
    from PIL import ImageDraw
    valido = nir[np.isfinite(nir)]
    bajo, alto = (np.percentile(valido, [1, 99]) if valido.size else (0.0, 1.0))
    gris = (np.clip((np.nan_to_num(nir) - bajo) / max(alto - bajo, 1e-9), 0, 1) * 255).astype(np.uint8)
    imagen = Image.fromarray(gris).convert("RGB")
    factor = ancho / imagen.width
    imagen = imagen.resize((ancho, max(1, round(imagen.height * factor))), Image.Resampling.BILINEAR)
    pincel = ImageDraw.Draw(imagen)
    for c in copas_detectadas:
        radio = max(2.0, c["diametroM"] / gsd_m / 2 * factor)
        x, y = c["x"] * factor, c["y"] * factor
        pincel.ellipse((x - radio, y - radio, x + radio, y + radio), outline=(255, 140, 0) if c.get("fusionada") else (0, 230, 118), width=1)
    buf = io.BytesIO()
    imagen.save(buf, format="JPEG", quality=82, optimize=True)
    return base64.b64encode(buf.getvalue()).decode("ascii")

