from __future__ import annotations

import logging
import os
import re
from pathlib import Path

import numpy as np
import tifffile
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from . import calculo, calibracion, ficha, imagenes, geo, escala, copas, mosaico, zonas as modulo_zonas
from .comparacion import comparar_analisis

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
    # Capturas con sus bandas para el mosaico aproximado del vuelo (todas las cenitales). Solo se usa si se piden mapas.
    capturasMosaico: list[Captura] = Field(default_factory=list, max_length=400)
    indicesMosaico: list[str] = Field(default_factory=lambda: ["NDVI", "NDRE"], max_length=3)
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


ANCHO_MOSAICO_PX = 1600


def repartir_uniforme(n: int, k: int) -> list[int]:
    """Índices de k elementos repartidos de forma pareja entre n (el primero y el último incluidos si k >= 2)."""
    k = min(k, n)
    if k <= 0:
        return []
    return [0] if k == 1 else sorted({round(i * (n - 1) / (k - 1)) for i in range(k)})


def seleccionar_capturas(p: Peticion) -> list[Captura]:
    """Elige las capturas a analizar. Con más candidatas que `maxImagenes`, se eligen solo entre las cenitales
    y georreferenciables (repartidas por el vuelo): las inclinadas no permiten ubicar zonas ni dibujar mapas."""
    if len(p.capturas) <= p.maxImagenes:
        return list(p.capturas)
    cenitales = []
    for cap in p.capturas:
        archivo = cap.bandas.get("nir")
        try:
            meta = ficha.leer(ruta_archivo(p.vueloId, archivo)) if archivo else {}
        except (OSError, ValueError, FileNotFoundError):
            continue
        if (meta.get("geo") or {}).get("georreferenciable"):
            cenitales.append(cap)
    base = cenitales or list(p.capturas)  # si ninguna es cenital, se analizan las primeras como antes
    return [base[i] for i in repartir_uniforme(len(base), p.maxImagenes)]


def construir_mosaicos(p: Peticion, efectivos: dict, advertencias: list[str]) -> list[dict]:
    """Mosaico aproximado por índice con todas las capturas cenitales. Ver app/mosaico.py: no es un ortomosaico."""
    nombres = [n for n in dict.fromkeys(p.indicesMosaico) if n in calculo.FORMULAS]
    necesarias = {b for n in nombres for b in calculo.FORMULAS[n][1:3]} | {"nir"}
    items = []
    for cap in p.capturasMosaico:
        if any(b not in cap.bandas for b in necesarias):
            continue
        try:
            meta = ficha.leer(ruta_archivo(p.vueloId, cap.bandas["nir"]))
        except (OSError, ValueError, FileNotFoundError):
            continue
        referencia, dimensiones = meta.get("geo") or {}, meta.get("resolucionPx")
        if not referencia.get("georreferenciable") or not dimensiones:
            continue
        gsd, origen = escala.gsd_para_captura(referencia, efectivos.get(cap.id))
        if gsd is None:
            continue
        items.append(dict(cap=cap, geo=referencia, gsd=gsd, origen=origen, ancho=dimensiones[0], alto=dimensiones[1]))
    if len(items) < 2 or not nombres:
        return []
    ref = mosaico.referencia(items)
    lim = mosaico.limites(items, ref)
    if lim is None:
        return []
    res = mosaico.resolucion_lienzo(lim, ANCHO_MOSAICO_PX)
    por_indice = {n: [] for n in nombres}
    for it in items:
        try:
            leidas = {b: leer_banda(p.vueloId, it["cap"].bandas[b])[0] for b in necesarias}
            bandas = calculo.igualar_formas(leidas)
        except Exception as e:  # TIFF ilegible: la captura simplemente no entra al mosaico
            log.warning("Mosaico: captura %s omitida (%s)", it["cap"].id, type(e).__name__)
            continue
        factor = max(1, int(res / it["gsd"]))
        for n in nombres:
            _, a, b = calculo.FORMULAS[n]
            idx = calculo.calcular(n, bandas[a], bandas[b])
            valores = mosaico.reducir(idx, factor)
            # `factor` se aplicó sobre la forma igualada: si difiere del original, se reescala el ancho/alto original
            por_indice[n].append({**it, "valores": valores, "factor": factor * (it["ancho"] / bandas[a].shape[1])})
        del leidas, bandas
    salida = []
    nominales = sum(1 for it in items if it["origen"] == "nominal")
    for n, lista in por_indice.items():
        if len(lista) < 2:
            continue
        m = mosaico.construir(lista, ref, lim, res)
        salida.append({"indice": n, "mime": "image/jpeg", "base64": imagenes.mapa_calor(m["valores"], "jpg", lado=max(m["ancho"], m["alto"])),
                       **{k: m[k] for k in ("resM", "ancho", "alto", "origenLat", "origenLon", "kx", "ky", "capturasUsadas", "coberturaPct")},
                       "capturasConGsdNominal": nominales})
    if salida:
        advertencias.append("El mosaico es aproximado: pega las capturas por GPS, orientación y GSD sobre terreno plano, sin corregir el relieve ni la lente; puede tener costuras y desplazamientos.")
    return salida


@app.get("/salud")
def salud():
    return {"ok": True}


@app.post("/analizar")
def analizar(p: Peticion):
    return analizar_peticion(p)


def analizar_peticion(p: Peticion, incluir_mapas: bool = True):
    if not (RAIZ / p.vueloId).is_dir() or not UUID.match(p.vueloId):
        raise HTTPException(404, "El vuelo no existe en el disco.")

    advertencias: list[str] = [geo.ADVERTENCIA]
    sin_calibrar = 0
    muestras: dict[str, list[np.ndarray]] = {n: [] for n in calculo.FORMULAS}
    candidatas: list[dict] = []
    mapas: list[dict] = []
    mapas_informe: list[dict] = []
    usadas = 0
    fichas = []
    rejillas_ndvi = []
    entradas_copas = []

    capturas_escala = []
    for n, cap in enumerate(seleccionar_capturas(p), start=1):
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
            if incluir_mapas and referencia.get('georreferenciable'):  # una captura inclinada no es un mapa
                mapas_informe.append({"titulo": f"{nombre} — captura {n}", "indice": nombre, "capturaId": cap.id,
                                      "cenital": True, "mime": "image/jpeg", "base64": imagenes.mapa_calor(idx, "jpg")})
            if nombre == "NDVI":
                # Llevar el NDVI ya calculado a los píxeles NIR originales y su GSD.
                original = leidas['nir'][0]
                filas = (np.arange(original.shape[0]) * idx.shape[0] / original.shape[0]).astype(int)
                cols = (np.arange(original.shape[1]) * idx.shape[1] / original.shape[1]).astype(int)
                entradas_copas.append((cap.id, referencia, original, idx[np.ix_(filas, cols)]))
                rejillas_ndvi.append(calculo.medias_celdas(idx))
                if incluir_mapas:
                    mapas.append({"titulo": f"NDVI — captura {n}", "indice": "NDVI", "capturaId": cap.id,
                              "mime": "image/png", "base64": imagenes.mapa_calor(idx)})
        if cap.rgb and incluir_mapas:
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
        advertencias.append(copas.ADVERTENCIA_GSD)
    if any(par['valido'] and par['razon'] < 0.9 for par in pares):
        advertencias.append('El GSD efectivo es menor que el nominal en parte del vuelo (terreno ascendente); se usó el efectivo donde fue medible.')
    for zona in candidatas:
        celdas, forma, referencia, escala_xy = zona.pop('_proyeccion')
        gsd, origen = escala.gsd_para_captura(referencia, efectivos.get(zona['capturaId']))
        proyeccion = geo.poligono_de_celdas(celdas, forma, referencia, gsd, escala_xy)
        if proyeccion is not None:
            proyeccion['poligono'] = geo.poligono_compacto(proyeccion['poligono'])
        zona.update(proyeccion or {'ubicacionZona': None, 'poligono': None, 'areaM2': None})
        if zona.get('areaM2') is not None:
            zona['areaM2'] = round(zona['areaM2'], 1)  # un decimal basta: el GSD no da más precisión
        zona['gsdOrigen'] = origen
    huellas = []
    analizadas = {f['id'] for f in fichas}
    for c in capturas_escala[:400]:
        g = c['geo']
        gsd_h, origen_h = escala.gsd_para_captura(g, efectivos.get(c['id']))
        if not g.get('georreferenciable') or gsd_h is None or g.get('cx') is None or g.get('cy') is None:
            continue
        ancho_h, alto_h = 2 * g['cx'], 2 * g['cy']
        esquinas = [geo.pixel_a_latlon(g, x, y, gsd_h) for x, y in ((0, 0), (ancho_h, 0), (ancho_h, alto_h), (0, alto_h))]
        if any(e is None for e in esquinas):
            continue
        huellas.append({'capturaId': c['id'], 'analizada': c['id'] in analizadas, 'gsdOrigen': origen_h,
                        'poligono': [[round(e['lat'], 6), round(e['lon'], 6)] for e in esquinas]})
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
    por_captura = []
    campos_conteo = ('conteo', 'areaAnalizadaM2', 'densidadPlantasHa', 'diametroCopaM',
                     'vecinoMasCercanoM', 'fusionadas', 'descartadasGrandes',
                     'masasGrandes', 'areaMasasGrandesM2')
    for captura_id, referencia, nir, ndvi in entradas_copas:
        gsd, origen = escala.gsd_para_captura(referencia, efectivos.get(captura_id))
        resultado_copas = {}
        if referencia.get('georreferenciable') and gsd is not None:
            try:
                resultado_copas = copas.detectar_copas(nir, ndvi, gsd)
                if incluir_mapas and resultado_copas.get('copas'):
                    mapas_informe.append({"titulo": f"Copas detectadas — captura {captura_id}", "indice": "COPAS", "capturaId": captura_id,
                                          "cenital": True, "mime": "image/jpeg",
                                          "base64": imagenes.mapa_copas(nir, resultado_copas['copas'], gsd)})
            except ValueError as error:
                advertencias.append(f'Captura {captura_id}: no se contaron copas ({error}).')
        por_captura.append({'capturaId': captura_id, 'gsdOrigen': origen,
                            **{campo: resultado_copas.get(campo) for campo in campos_conteo}})
    del entradas_copas
    teorica = calculo.densidad_teorica(p.siembra.distSurcoM, p.siembra.distPlantaM) if p.siembra else None
    plantas = copas.resumir_capturas(por_captura, teorica)
    siembra = None
    if p.siembra:
        siembra = {
            "distSurcoM": p.siembra.distSurcoM,
            "distPlantaM": p.siembra.distPlantaM,
            "plantasPorHaTeorica": calculo.densidad_teorica(p.siembra.distSurcoM, p.siembra.distPlantaM),
            "variedad": p.siembra.variedad,
            "alturaPlantaM": p.siembra.alturaPlantaM,
            "provisional": p.siembra.provisional,
            # Densidad experimental; no representa un total del lote.
            "plantasPorHaDetectada": plantas["densidadMediaPlantasHa"],
            "diferenciaPct": plantas["diferenciaVsTeoricaPct"],
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
    zonas = modulo_zonas.fusionar(zonas)  # el mismo sitio detectado por varios índices o capturas es una sola zona
    zonas.sort(key=lambda c: -c["_peso"])
    for i, z in enumerate(zonas, start=1):
        z.pop("_peso")
        z["id"] = f"Z{i}"
    zonas = [{"id": z["id"], **{k: v for k, v in z.items() if k != "id"}} for z in zonas]

    mosaicos = construir_mosaicos(p, efectivos, advertencias) if incluir_mapas and p.capturasMosaico else []
    return {"capturasUsadas": usadas, "capturasAnalizadas": [f["id"] for f in fichas], "indices": indices, "vigor": vigor, "cobertura": cobertura, "siembra": siembra,
            "plantas": plantas, "zonasCandidatas": zonas, "mapas": mapas, "mapasInforme": mapas_informe, "huellas": huellas, "mosaicos": mosaicos,
            "advertencias": advertencias,
            "ficha": ficha.resumir(fichas, pares), "variabilidadEspacial": calculo.variabilidad_espacial(rejillas_ndvi)}


class PeticionComparacion(BaseModel):
    a: Peticion
    b: Peticion
    fechaA: str | None = None
    fechaB: str | None = None
    nombreA: str | None = None
    nombreB: str | None = None
    ruidoMinimo: float | None = Field(None, ge=0, allow_inf_nan=False)


def huella_peticion(p: Peticion):
    """Caja aproximada de encuadres cenitales con GSD nominal; solo lee metadatos."""
    puntos = []
    for cap in p.capturasEscala or p.capturas:
        archivo = cap.bandas.get('nir')
        if not archivo:
            return None
        try:
            meta = ficha.leer(ruta_archivo(p.vueloId, archivo))
        except (OSError, ValueError):
            return None
        referencia = meta.get('geo') or {}
        if not referencia.get('georreferenciable'):
            continue
        dimensiones = meta.get('resolucionPx')
        gsd = geo.gsd_m_px(referencia.get('alturaRelativaM'), referencia.get('focalPx'))
        if not dimensiones or gsd is None:
            return None
        ancho, alto = dimensiones
        referencia = {**referencia, 'cx': ancho/2, 'cy': alto/2}
        esquinas = [geo.pixel_a_latlon(referencia, x, y, gsd)
                    for x, y in ((0, 0), (ancho, 0), (ancho, alto), (0, alto))]
        if any(punto is None for punto in esquinas):
            return None
        puntos.extend(esquinas)
    if not puntos:
        return None
    return dict(latMin=min(v['lat'] for v in puntos), latMax=max(v['lat'] for v in puntos),
                lonMin=min(v['lon'] for v in puntos), lonMax=max(v['lon'] for v in puntos))


@app.post('/comparar')
def comparar(p: PeticionComparacion):
    vuelos = []
    for peticion, fecha, nombre in ((p.a, p.fechaA, p.nombreA), (p.b, p.fechaB, p.nombreB)):
        analisis = analizar_peticion(peticion, incluir_mapas=False)
        analisis.pop('mapas', None)
        vuelos.append(dict(vueloId=peticion.vueloId, nombre=nombre, fecha=fecha,
                           analisis=analisis, huella=huella_peticion(peticion)))
    resultado = comparar_analisis(*vuelos, parametros={'ruidoMinimo': p.ruidoMinimo})
    resultado['vuelos'] = {clave: {k: vuelo[k] for k in ('vueloId', 'nombre', 'fecha', 'huella')}
                           for clave, vuelo in zip(('a', 'b'), vuelos)}
    if (p.a.umbrales, p.a.umbralVigorBajo, p.a.umbralVigorAlto, p.a.umbralCobertura) != (
            p.b.umbrales, p.b.umbralVigorBajo, p.b.umbralVigorAlto, p.b.umbralCobertura):
        resultado['advertencias'].append('Umbrales distintos: las áreas bajo umbral, el vigor y la cobertura usan cortes diferentes.')
    resultado['advertencias'].append('La huella es una caja aproximada con GSD nominal y terreno plano; no es una superficie común registrada.')
    return resultado
