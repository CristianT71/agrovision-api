from __future__ import annotations

import logging
import os
import re
from pathlib import Path

import numpy as np
import tifffile
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from . import calculo, calibracion, ficha, imagenes, geo, escala

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
    """Marco de siembra configurable. No existe una distancia universal: depende de la variedad, el porte,
    el sistema de producción y el terreno. Mientras no se confirme con el agrónomo se marca como provisional."""
    distSurcoM: float = Field(gt=0, le=20)
    distPlantaM: float = Field(gt=0, le=20)
    variedad: str | None = Field(None, max_length=60)
    alturaPlantaM: float | None = Field(None, gt=0, le=8)
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
    # Todas las capturas del vuelo (solo banda NIR): sirven únicamente para medir el GSD efectivo con pares
    # consecutivos. Las capturas de `capturas` pueden estar muy separadas y no se solapan entre sí.
    capturasEscala: list[Captura] = Field(default_factory=list, max_length=400)
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

    advertencias: list[str] = [geo.ADVERTENCIA]
    sin_calibrar = 0
    muestras: dict[str, list[np.ndarray]] = {n: [] for n in calculo.FORMULAS}
    candidatas: list[dict] = []
    mapas: list[dict] = []
    usadas = 0
    fichas = []
    rejillas_ndvi = []

    capturas_escala = []
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
        metadatos = {b: ficha.leer(ruta_archivo(p.vueloId, cap.bandas[b])) for b in BANDAS}
        referencia = metadatos['nir']['geo']
        capturas_escala.append({'id': cap.id, 'geo': referencia, 'imagen': leidas['nir'][0],
                                'fecha': metadatos['nir']['fecha']})
        fichas.append({
            "id": cap.id,
            "metadatos": list(metadatos.values()),
            "geo": referencia,
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
                # Proyectar en píxeles NIR originales, incluso tras igualar las bandas.
                forma_nir = leidas['nir'][0].shape
                escala_xy = (forma_nir[1] / idx.shape[1], forma_nir[0] / idx.shape[0])
                candidatas.append({
                    "indice": nombre,
                    "valor": round(z["valor"], 3),
                    "areaPct": round(z["areaPct"], 1),
                    "capturaId": cap.id,
                    # Campo histórico: conserva el centro indicado de la captura
                    "ubicacion": cap.ubicacion.model_dump() if cap.ubicacion else None,
                    "_proyeccion": (z['celdas'], idx.shape, referencia, escala_xy),
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

    if p.capturasEscala:
        capturas_escala = []
        for cap in p.capturasEscala:
            archivo = cap.bandas.get('nir')
            if not archivo:
                continue
            try:
                meta = ficha.leer(ruta_archivo(p.vueloId, archivo))
            except Exception:
                continue
            capturas_escala.append({'id': cap.id, 'geo': meta['geo'], 'fecha': meta['fecha'],
                                    'imagen': (lambda a=archivo: leer_banda(p.vueloId, a)[0])})
    # Sin hora comparable no se inventa una secuencia de pares. Las horas iguales
    # conservan su posición, pero sus pares se descartan para no saltar vecinos.
    fechadas = [c for c in capturas_escala if c['fecha'] is not None]
    pares = []
    efectivos = {}
    if len(fechadas) == len(capturas_escala) and len({c['fecha'].tzinfo is not None for c in fechadas}) == 1:
        fechadas.sort(key=lambda c: c['fecha'])
        repetidas = {c['fecha'] for c in fechadas if sum(v['fecha'] == c['fecha'] for v in fechadas) > 1}
        ordenadas = [{**c, 'geo': {**c['geo'], 'georreferenciable': False}} if c['fecha'] in repetidas else c for c in fechadas]
        resultado = escala.gsd_efectivo_pares(ordenadas)
        pares = resultado['pares']
        efectivos = {c['id']: c['gsdEfectivoM'] for c in resultado['capturas']}
    for f in fichas:
        f['gsdEfectivoM'] = efectivos.get(f['id'])
    if any(escala.gsd_para_captura(f['geo'], f['gsdEfectivoM'])[1] == 'nominal' for f in fichas):
        advertencias.append('Hay capturas con GSD nominal: la altura es relativa al despegue y en terreno inclinado el tamaño del píxel puede estar sobrestimado.')
    if any(par['valido'] and par['razon'] < 0.9 for par in pares):
        advertencias.append('El GSD efectivo es menor que el nominal en parte del vuelo (terreno ascendente); se usó el efectivo donde fue medible.')
    for zona in candidatas:
        celdas, forma, referencia, escala_xy = zona.pop('_proyeccion')
        gsd, origen = escala.gsd_para_captura(referencia, efectivos.get(zona['capturaId']))
        proyeccion = geo.poligono_de_celdas(celdas, forma, referencia, gsd, escala_xy)
        if proyeccion is not None:
            proyeccion['poligono'] = geo.poligono_compacto(proyeccion['poligono'])
        zona.update(proyeccion or {'ubicacionZona': None, 'poligono': None, 'areaM2': None})
        zona['gsdOrigen'] = origen
    del capturas_escala

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
            "variedad": p.siembra.variedad,
            "alturaPlantaM": p.siembra.alturaPlantaM,
            "provisional": p.siembra.provisional,
            # Se llenan cuando exista el conteo de plantas con el dron; hasta entonces no se compara con la teórica.
            "plantasPorHaDetectada": None,
            "diferenciaPct": None,
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
            "ficha": ficha.resumir(fichas, pares), "variabilidadEspacial": calculo.variabilidad_espacial(rejillas_ndvi)}
