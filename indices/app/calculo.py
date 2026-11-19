"""Cálculo de índices de vegetación. Solo numpy: no usa ningún modelo de IA."""
from __future__ import annotations

import numpy as np

FORMULAS = {
    "NDVI": ("(NIR - R) / (NIR + R)", "nir", "red"),
    "NDRE": ("(NIR - RE) / (NIR + RE)", "nir", "rededge"),
    "GNDVI": ("(NIR - G) / (NIR + G)", "nir", "green"),
}
CELDAS = 24          # rejilla para buscar zonas (CELDAS x CELDAS por captura)
MIN_CELDAS_ZONA = 3  # una zona es un grupo de al menos estas celdas contiguas
# provisional, calibrar con el agrónomo
VARIABILIDAD_BAJA = 0.08
VARIABILIDAD_ALTA = 0.15
MEDIA_CASI_CERO = 1e-8
MAX_MUESTRA = 400_000  # píxeles que se guardan por índice y captura para las estadísticas


def indice(nir: np.ndarray, otra: np.ndarray) -> np.ndarray:
    """(a - b) / (a + b) con NaN donde no hay dato (suma cero o píxel sin señal)."""
    a = nir.astype(np.float32)
    b = otra.astype(np.float32)
    suma = a + b
    valido = (suma > 0) & (a > 0) & (b > 0)
    salida = np.full(a.shape, np.nan, dtype=np.float32)
    np.divide(a - b, suma, out=salida, where=valido)
    return salida


def calcular(nombre: str, nir: np.ndarray, otra: np.ndarray) -> np.ndarray:
    """Calcula el índice por su nombre (todos son diferencias normalizadas).

    SAVI no se incluye: su constante de suelo (L = 0,5) solo tiene sentido con reflectancia de 0 a 1 y las bandas
    calibradas de este dron no están en esa escala (daba valores de ~0,002).
    """
    return indice(nir, otra)


def igualar_formas(bandas: dict[str, np.ndarray]) -> dict[str, np.ndarray]:
    """Si las bandas difieren de tamaño, las lleva al más pequeño (vecino más próximo)."""
    alto = min(b.shape[0] for b in bandas.values())
    ancho = min(b.shape[1] for b in bandas.values())
    salida = {}
    for nombre, b in bandas.items():
        if b.shape != (alto, ancho):
            filas = (np.arange(alto) * b.shape[0] / alto).astype(int)
            cols = (np.arange(ancho) * b.shape[1] / ancho).astype(int)
            b = b[np.ix_(filas, cols)]
        salida[nombre] = b
    return salida


def muestra(valores: np.ndarray) -> np.ndarray:
    v = valores[np.isfinite(valores)]
    if v.size > MAX_MUESTRA:
        v = v[:: v.size // MAX_MUESTRA + 1]
    return v


def resumen(muestras: list[np.ndarray], umbral: float) -> dict | None:
    if not muestras:
        return None
    v = np.concatenate(muestras)
    v = v[np.isfinite(v)]
    if v.size == 0:
        return None
    p10, mediana, p90 = np.percentile(v, [10, 50, 90])
    media = float(v.mean())
    desviacion = float(np.std(v, dtype=np.float64))
    return {
        "media": round(media, 3),
        "desviacion": round(desviacion, 3),
        "cv": round(desviacion / abs(media), 3) if abs(media) > MEDIA_CASI_CERO else None,
        "mediana": round(float(mediana), 3),
        "p10": round(float(p10), 3),
        "p90": round(float(p90), 3),
        "umbral": umbral,
        "areaBajoUmbralPct": round(float((v < umbral).mean() * 100), 1),
    }


def medias_celdas(idx: np.ndarray) -> np.ndarray:
    """Misma rejilla y recorte que zonas_bajas; exige al menos 50 % de datos finitos."""
    alto, ancho = idx.shape
    h, w = alto // CELDAS, ancho // CELDAS
    if h < 1 or w < 1:
        return np.empty((0, 0), dtype=np.float64)
    recorte = idx[: h * CELDAS, : w * CELDAS].reshape(CELDAS, h, CELDAS, w)
    validos = np.isfinite(recorte)
    cuenta = validos.sum(axis=(1, 3))
    suma = np.where(validos, recorte, 0).sum(axis=(1, 3), dtype=np.float64)
    medias = np.full((CELDAS, CELDAS), np.nan)
    np.divide(suma, cuenta, out=medias, where=cuenta >= (h * w) * 0.5)
    return medias


def variabilidad_espacial(rejillas: list[np.ndarray]) -> dict:
    """Desviación poblacional de las medias válidas, con igual peso por celda/captura."""
    v = np.concatenate([r[np.isfinite(r)] for r in rejillas]) if rejillas else np.array([])
    if v.size == 0:
        return {"desviacion": None, "celdasValidas": 0, "nivel": None}
    desviacion = float(np.std(v, dtype=np.float64))
    nivel = "baja" if desviacion < VARIABILIDAD_BAJA else "media" if desviacion < VARIABILIDAD_ALTA else "alta"
    return {"desviacion": round(desviacion, 3), "celdasValidas": int(v.size), "nivel": nivel}


def zonas_bajas(idx: np.ndarray, umbral: float) -> list[dict]:
    """Grupos contiguos de celdas de la rejilla cuyo valor medio queda bajo el umbral.

    Devuelve [{valor, areaPct, cx, cy}] con el centro en fracción de la imagen (0..1).
    """
    medias = medias_celdas(idx)
    if medias.size == 0:
        return []
    bajas = np.isfinite(medias) & (medias < umbral)

    visto = np.zeros_like(bajas)
    zonas = []
    for i in range(CELDAS):
        for j in range(CELDAS):
            if not bajas[i, j] or visto[i, j]:
                continue
            pila, celdas = [(i, j)], []
            visto[i, j] = True
            while pila:
                y, x = pila.pop()
                celdas.append((y, x))
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < CELDAS and 0 <= nx < CELDAS and bajas[ny, nx] and not visto[ny, nx]:
                        visto[ny, nx] = True
                        pila.append((ny, nx))
            if len(celdas) < MIN_CELDAS_ZONA:
                continue
            ys = np.array([c[0] for c in celdas])
            xs = np.array([c[1] for c in celdas])
            zonas.append({
                "valor": float(np.mean([medias[y, x] for y, x in celdas])),
                "areaPct": len(celdas) / (CELDAS * CELDAS) * 100,
                "cx": float((xs.mean() + 0.5) / CELDAS),
                "cy": float((ys.mean() + 0.5) / CELDAS),
            })
    return zonas


def clases_vigor(muestras: list[np.ndarray], umbral_bajo: float, umbral_alto: float) -> dict | None:
    """Reparte los píxeles válidos de NDVI en vigor bajo (< bajo), medio y alto (>= alto), en porcentaje."""
    if not muestras:
        return None
    v = np.concatenate(muestras)
    if v.size == 0:
        return None
    bajo = float((v < umbral_bajo).mean() * 100)
    alto = float((v >= umbral_alto).mean() * 100)
    return {
        "bajoPct": round(bajo, 1),
        "medioPct": round(100 - bajo - alto, 1),
        "altoPct": round(alto, 1),
        "umbralBajo": umbral_bajo,
        "umbralAlto": umbral_alto,
        "base": "píxeles válidos de NDVI de las capturas analizadas",
    }


def cobertura_vegetal(muestras: list[np.ndarray], umbral: float) -> dict | None:
    """Porcentaje de píxeles con NDVI a partir del umbral (vegetación frente a suelo o sombra)."""
    if not muestras:
        return None
    v = np.concatenate(muestras)
    if v.size == 0:
        return None
    return {"pct": round(float((v >= umbral).mean() * 100), 1), "umbralNdvi": umbral}


def densidad_teorica(dist_surco_m: float, dist_planta_m: float) -> float:
    """Plantas por hectárea según el marco de siembra: 10 000 m² / (surco × planta)."""
    return round(10000 / (dist_surco_m * dist_planta_m), 0)
