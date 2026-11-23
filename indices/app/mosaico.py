"""Mosaico aproximado de un vuelo: pega cada captura cenital en un lienzo común según su posición GPS, su
orientación y su tamaño de píxel (GSD).

Es una APROXIMACIÓN, no un ortomosaico: supone terreno plano y cámara en nadir, no corrige la lente ni el relieve
y no alinea las capturas entre sí. Donde el terreno sube o el GSD es impreciso aparecen costuras y desplazamientos.
El lienzo queda con el norte arriba; las coordenadas del resultado permiten dibujar encima polígonos y escala.
"""
from __future__ import annotations

import math

import numpy as np
from PIL import Image

from . import geo

METROS_POR_GRADO = 111320.0
RESOLUCION_MINIMA_M = 0.03      # no se pide más detalle que 3 cm/píxel (provisional)
MAX_PIXELES_LIENZO = 4_000_000  # tope de memoria del lienzo
BORDE_SUAVE = 0.12              # fracción de la captura donde el peso baja hacia el borde (reduce costuras)


def referencia(items):
    """Origen local (lat0, lon0) y metros por grado, a partir del centro de las capturas."""
    lat0 = float(np.mean([i['geo']['lat'] for i in items]))
    lon0 = float(np.mean([i['geo']['lon'] for i in items]))
    return dict(lat0=lat0, lon0=lon0, kx=METROS_POR_GRADO * math.cos(math.radians(lat0)), ky=METROS_POR_GRADO)


def _a_metros(ref, punto):
    return np.array([(punto['lon'] - ref['lon0']) * ref['kx'], (ref['lat0'] - punto['lat']) * ref['ky']])


def ajuste_afin(item, ref, ancho, alto):
    """Transformación píxel original -> metros locales (x este, y sur), ajustada con 3 puntos proyectados con geo.py."""
    g, gsd = item['geo'], item['gsd']
    puntos = [geo.pixel_a_latlon(g, x, y, gsd) for x, y in ((0, 0), (ancho, 0), (0, alto))]
    if any(p is None for p in puntos):
        return None
    m0, mx, my = (_a_metros(ref, p) for p in puntos)
    a = np.array([[(mx[0] - m0[0]) / ancho, (my[0] - m0[0]) / alto],
                  [(mx[1] - m0[1]) / ancho, (my[1] - m0[1]) / alto]])
    if abs(np.linalg.det(a)) < 1e-12:
        return None
    return a, m0


def esquinas_m(item, ref, ancho, alto):
    ajuste = ajuste_afin(item, ref, ancho, alto)
    if ajuste is None:
        return None
    a, t = ajuste
    return [a @ np.array(c, dtype=float) + t for c in ((0, 0), (ancho, 0), (ancho, alto), (0, alto))]


def limites(items, ref):
    """Caja (xmin, ymin, xmax, ymax) en metros que cubre todas las capturas, o None."""
    cajas = []
    for i in items:
        e = esquinas_m(i, ref, i['ancho'], i['alto'])
        if e is not None:
            cajas.extend(e)
    if not cajas:
        return None
    pts = np.array(cajas)
    return float(pts[:, 0].min()), float(pts[:, 1].min()), float(pts[:, 0].max()), float(pts[:, 1].max())


def resolucion_lienzo(lim, ancho_max_px, minima=RESOLUCION_MINIMA_M):
    xmin, ymin, xmax, ymax = lim
    res = max(minima, max(xmax - xmin, ymax - ymin) / ancho_max_px)
    while ((xmax - xmin) / res) * ((ymax - ymin) / res) > MAX_PIXELES_LIENZO:
        res *= 1.25
    return res


def _peso_borde(alto, ancho):
    u = np.minimum(np.arange(ancho), ancho - 1 - np.arange(ancho))[None, :]
    v = np.minimum(np.arange(alto), alto - 1 - np.arange(alto))[:, None]
    margen = max(1.0, BORDE_SUAVE * min(alto, ancho))
    return np.clip(np.minimum(u, v) / margen, 0, 1).astype(np.float32) + 1e-3


def construir(items, ref, lim, res_m):
    """Promedio ponderado (más peso al centro de cada captura) de las capturas sobre el lienzo.

    items: {geo, gsd, valores (2D reducida, NaN = sin dato), factor (reducción entera), ancho, alto (originales)}.
    Devuelve el lienzo (NaN donde no hay dato) y los datos para ubicarlo.
    """
    xmin, ymin, xmax, ymax = lim
    nx, ny = max(1, math.ceil((xmax - xmin) / res_m)), max(1, math.ceil((ymax - ymin) / res_m))
    suma = np.zeros((ny, nx), dtype=np.float32)
    pesos = np.zeros((ny, nx), dtype=np.float32)
    usadas = 0
    for it in items:
        valores = np.asarray(it['valores'], dtype=np.float32)
        h, w = valores.shape
        f = it.get('factor', 1)
        ajuste = ajuste_afin(it, ref, it['ancho'], it['alto'])
        if ajuste is None:
            continue
        a, t = ajuste
        # píxel reducido -> píxel original: p = f*q + (f-1)/2
        a_r = a * f
        t_r = t + a @ np.array([(f - 1) / 2, (f - 1) / 2])
        inv = np.linalg.inv(a_r)
        esq = [a_r @ np.array(c, dtype=float) + t_r for c in ((0, 0), (w, 0), (w, h), (0, h))]
        px = [((e[0] - xmin) / res_m, (e[1] - ymin) / res_m) for e in esq]
        x0, x1 = max(0, math.floor(min(p[0] for p in px))), min(nx, math.ceil(max(p[0] for p in px)))
        y0, y1 = max(0, math.floor(min(p[1] for p in px))), min(ny, math.ceil(max(p[1] for p in px)))
        if x1 <= x0 or y1 <= y0:
            continue
        m = inv * res_m                      # píxel de lienzo -> píxel reducido
        origen = inv @ (np.array([xmin + x0 * res_m, ymin + y0 * res_m]) - t_r)
        coef = (m[0, 0], m[0, 1], origen[0], m[1, 0], m[1, 1], origen[1])
        ok = np.isfinite(valores)
        peso = _peso_borde(h, w) * ok
        val = np.where(ok, valores, 0).astype(np.float32) * peso
        tam = (x1 - x0, y1 - y0)
        t_val = np.asarray(Image.fromarray(val, mode='F').transform(tam, Image.AFFINE, coef, Image.BILINEAR))
        t_pes = np.asarray(Image.fromarray(peso.astype(np.float32), mode='F').transform(tam, Image.AFFINE, coef, Image.BILINEAR))
        suma[y0:y1, x0:x1] += t_val
        pesos[y0:y1, x0:x1] += t_pes
        usadas += 1
    lienzo = np.full((ny, nx), np.nan, dtype=np.float32)
    cubierto = pesos > 0.02
    lienzo[cubierto] = suma[cubierto] / pesos[cubierto]
    return dict(valores=lienzo, resM=res_m, ancho=nx, alto=ny, capturasUsadas=usadas,
                origenLat=ref['lat0'] - ymin / ref['ky'], origenLon=ref['lon0'] + xmin / ref['kx'],
                kx=ref['kx'], ky=ref['ky'],
                latMin=ref['lat0'] - ymax / ref['ky'], lonMax=ref['lon0'] + xmax / ref['kx'],
                coberturaPct=float(100 * cubierto.mean()))


def reducir(valores, factor):
    """Promedio por bloques (ignora NaN). Devuelve la matriz reducida; los bordes sobrantes se descartan."""
    if factor <= 1:
        return np.asarray(valores, dtype=np.float32)
    h, w = valores.shape[0] // factor * factor, valores.shape[1] // factor * factor
    bloques = valores[:h, :w].reshape(h // factor, factor, w // factor, factor).astype(np.float32)
    ok = np.isfinite(bloques)
    suma = np.where(ok, bloques, 0).sum(axis=(1, 3))
    n = ok.sum(axis=(1, 3))
    return np.where(n > 0, suma / np.maximum(n, 1), np.nan).astype(np.float32)
