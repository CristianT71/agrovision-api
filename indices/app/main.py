from __future__ import annotations

import logging
import os
import re
from pathlib import Path

import numpy as np
import tifffile
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from . import calculo, calibracion, ficha, imagenes

log = logging.getLogger("indices")
RAIZ = Path(os.environ.get("RAIZ_VUELOS", "/datos/vuelos"))
UUID = re.compile(r"^[0-9a-fA-F-]{36}$")
BANDAS = ("green", "red", "rededge", "nir")
MAX_ZONAS_POR_INDICE = 2

app = FastAPI(title="Servicio de índices AgroVisión")


class Ubicacion(BaseModel):
    lat: float
    lon: float


class Captura(BaseModel):
    id: str
    bandas: dict[str, str]
    rgb: str | None = None
    ubicacion: Ubicacion | None = None
    capturadoEn: str | None = None


class Siembra(BaseModel):
    distSurcoM: float = Field(gt=0, le=20)
    distPlantaM: float = Field(gt=0, le=20)
    provisional: bool = True


class Peticion(BaseModel):
    vueloId: str
    umbrales: dict[str, float] = Field(default_factory=lambda: {"NDVI": 0.5, "NDRE": 0.3, "GNDVI": 0.45})
    # Cortes del vigor y de la cobertura sobre NDVI. Son provisionales hasta calibrarlos con el agrónomo.
    umbralVigorBajo: float = Field(0.3, gt=0, lt=1)
    umbralVigorAlto: float = Field(0.6, gt=0, lt=1)
    umbralCobertura: float = Field(0.4, gt=0, lt=1)
    # Marco de siembra en metros. Si no viene, no se calcula la densidad teórica.
    siembra: Siembra | None = None
    maxImagenes: int = Field(4, ge=1, le=12)
    capturas: list[Captura] = Field(min_length=1)


def ruta_archivo(vuelo_id: str, archivo_id: str) -> Path:
    # Los ids vienen de fuera: solo UUID, así no se puede salir de la carpeta del vuelo
    if not UUID.match(vuelo_id) or not UUID.match(archivo_id):
        raise HTTPException(422, "Identificador de vuelo o archivo no válido.")
    for p in sorted((RAIZ / vuelo_id).glob(f"{archivo_id}.*")):
        if not p.name.endswith(".miniatura.jpg"):
            return p
    raise FileNotFoundError(f"No existe el archivo {archivo_id} del vuelo.")


def leer_banda(vuelo_id: str, archivo_id: str) -> tuple[np.ndarray, bool]:
    """Devuelve la banda y si se pudo calibrar con los metadatos del dron."""
    ruta = ruta_archivo(vuelo_id, archivo_id)
    datos = tifffile.imread(ruta)
    if datos.ndim == 3:  # algunos TIFF traen una dimensión de canal sobrante
        datos = datos[..., 0] if datos.shape[-1] <= 4 else datos[0]
    try:
        params = calibracion.parametros(calibracion.leer_xmp(ruta))
    except Exception:
        params = None
    if params is None:
        return datos, False
    return calibracion.calibrar(datos, params), True


@app.get("/salud")
def salud():
    return {"ok": True}


@app.post("/analizar")
def analizar(p: Peticion):
    if not (RAIZ / p.vueloId).is_dir() or not UUID.match(p.vueloId):
        raise HTTPException(404, "El vuelo no existe en el disco.")

    advertencias: list[str] = []
    sin_calibrar = 0
    muestras: dict[str, list[np.ndarray]] = {n: [] for n in calculo.FORMULAS}
    candidatas: list[dict] = []
    mapas: list[dict] = []
    usadas = 0
    fichas = []
    rejillas_ndvi = []

    for n, cap in enumerate(p.capturas[: p.maxImagenes], start=1):
        faltan = [b for b in BANDAS if b not in cap.bandas]
        if faltan:
            advertencias.append(f"Captura {cap.id} sin banda(s): {', '.join(faltan)}.")
            continue
        try:
            leidas = {b: leer_banda(p.vueloId, cap.bandas[b]) for b in BANDAS}
            bandas = calculo.igualar_formas({b: v[0] for b, v in leidas.items()})
            if not all(v[1] for v in leidas.values()):
                sin_calibrar += 1
        except FileNotFoundError as e:
            advertencias.append(f"Captura {cap.id}: {e}")
            continue
        except Exception as e:  # TIFF dañado o ilegible
            log.exception("Fallo leyendo la captura %s", cap.id)
            advertencias.append(f"Captura {cap.id}: no se pudo leer ({type(e).__name__}).")
            continue
        usadas += 1
        fichas.append({
            "metadatos": [ficha.leer(ruta_archivo(p.vueloId, cap.bandas[b])) for b in BANDAS],
            "bandas": list(bandas),
            "calibrada": all(v[1] for v in leidas.values()),
        })
        if cap.ubicacion is None:
            advertencias.append(f"Captura {cap.id} sin georreferencia.")

        for nombre, (_, a, b) in calculo.FORMULAS.items():
            idx = calculo.calcular(nombre, bandas[a], bandas[b])
            umbral = p.umbrales.get(nombre, 0.5)
            muestras[nombre].append(calculo.muestra(idx))
            for z in calculo.zonas_bajas(idx, umbral):
                candidatas.append({
                    "indice": nombre,
                    "valor": round(z["valor"], 3),
                    "areaPct": round(z["areaPct"], 1),
                    "capturaId": cap.id,
                    # Sin georreferencia por píxel: se da el centro de la captura
                    "ubicacion": cap.ubicacion.model_dump() if cap.ubicacion else None,
                    "_peso": (umbral - z["valor"]) * z["areaPct"],
                })
            if nombre == "NDVI":
                rejillas_ndvi.append(calculo.medias_celdas(idx))
                mapas.append({"titulo": f"NDVI — captura {n}", "indice": "NDVI", "capturaId": cap.id,
                              "mime": "image/png", "base64": imagenes.mapa_calor(idx)})
        if cap.rgb:
            try:
                mapas.append({"titulo": f"Foto RGB — captura {n}", "indice": "RGB", "capturaId": cap.id,
                              "mime": "image/jpeg", "base64": imagenes.foto_rgb(str(ruta_archivo(p.vueloId, cap.rgb)))})
            except Exception:
                advertencias.append(f"Captura {cap.id}: no se pudo leer la foto RGB.")

    if usadas == 0:
        raise HTTPException(422, "Ninguna captura se pudo procesar. " + " ".join(advertencias[1:]))

    if sin_calibrar:
        advertencias.append(
            f"{sin_calibrar} captura(s) sin metadatos de calibración del dron: sus índices se calcularon con valores "
            "crudos y no son comparables con los calibrados."
        )
    else:
        advertencias.append(
            "Índices calibrados con los metadatos del dron (nivel de negro, ganancia, exposición e irradiancia solar). "
            "Es reflectancia relativa: sin panel de reflectancia en campo no es reflectancia absoluta."
        )

    indices = []
    for nombre, (formula, _, _) in calculo.FORMULAS.items():
        r = calculo.resumen(muestras[nombre], p.umbrales.get(nombre, 0.5))
        if r:
            indices.append({"nombre": nombre, "formula": formula, **r})

    vigor = calculo.clases_vigor(muestras["NDVI"], p.umbralVigorBajo, p.umbralVigorAlto)
    cobertura = calculo.cobertura_vegetal(muestras["NDVI"], p.umbralCobertura)
    siembra = None
    if p.siembra:
        siembra = {
            "distSurcoM": p.siembra.distSurcoM,
            "distPlantaM": p.siembra.distPlantaM,
            "plantasPorHaTeorica": calculo.densidad_teorica(p.siembra.distSurcoM, p.siembra.distPlantaM),
            "provisional": p.siembra.provisional,
            "conteoReal": None,
            "nota": "Densidad teórica del marco de siembra indicado"
            + (" (valor provisional, sin confirmar)" if p.siembra.provisional else "")
            + ". El conteo real de plantas con el dron no está calculado.",
        }
    if p.umbralVigorBajo >= p.umbralVigorAlto:
        raise HTTPException(422, "umbralVigorBajo debe ser menor que umbralVigorAlto.")

    zonas = []
    for nombre in calculo.FORMULAS:
        de_indice = sorted((c for c in candidatas if c["indice"] == nombre), key=lambda c: -c["_peso"])
        zonas += de_indice[:MAX_ZONAS_POR_INDICE]
    zonas.sort(key=lambda c: -c["_peso"])
    for i, z in enumerate(zonas, start=1):
        z.pop("_peso")
        z["id"] = f"Z{i}"
    zonas = [{"id": z["id"], **{k: v for k, v in z.items() if k != "id"}} for z in zonas]

    return {"capturasUsadas": usadas, "indices": indices, "vigor": vigor, "cobertura": cobertura, "siembra": siembra,
            "zonasCandidatas": zonas, "mapas": mapas, "advertencias": advertencias,
            "ficha": ficha.resumir(fichas), "variabilidadEspacial": calculo.variabilidad_espacial(rejillas_ndvi)}
