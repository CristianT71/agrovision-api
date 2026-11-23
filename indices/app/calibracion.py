"""Calibración radiométrica de las bandas del DJI Mavic 3M (M3M).

Usa los metadatos XMP que el dron guarda en cada TIFF:
  reflectancia relativa = (DN - BlackLevel) / (SensorGain * ExposureTime) * SensorGainAdjustment / Irradiance
Irradiance viene del sensor solar de esa captura y banda, así que corrige la luz del momento
y la sensibilidad de cada banda. Sin panel de reflectancia en campo no es reflectancia absoluta,
pero sí deja los índices comparables entre bandas, capturas y vuelos.
"""
from __future__ import annotations

import re

import numpy as np
import tifffile

_CAMPOS = ("BlackLevel", "SensorGain", "ExposureTime", "SensorGainAdjustment", "Irradiance")


def leer_xmp(ruta) -> str:
    with tifffile.TiffFile(ruta) as t:
        tag = t.pages[0].tags.get(700)  # 700 = paquete XMP
        return tag.value.decode("utf-8", "ignore") if tag is not None else ""


def parametros(xmp: str) -> dict[str, float] | None:
    """Los 5 parámetros, o None si falta alguno o no son válidos (se usa la banda sin calibrar)."""
    p: dict[str, float] = {}
    for campo in _CAMPOS:
        m = re.search(rf'drone-dji:{campo}="([^"]+)"', xmp)
        if not m:
            return None
        try:
            p[campo] = float(m.group(1))
        except ValueError:
            return None
    if p["SensorGain"] <= 0 or p["ExposureTime"] <= 0 or p["Irradiance"] <= 0:
        return None
    return p


def calibrar(dn: np.ndarray, p: dict[str, float]) -> np.ndarray:
    # DN no es negativo tras restar el nivel de negro; lo que queda en 0 se trata como sin dato
    señal = np.clip(dn.astype(np.float32) - p["BlackLevel"], 0, None)
    return señal / (p["SensorGain"] * p["ExposureTime"]) * p["SensorGainAdjustment"] / p["Irradiance"]
