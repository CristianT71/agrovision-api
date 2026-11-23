"""Fusión de zonas candidatas que son el mismo sitio.

Cada índice (NDVI, NDRE, GNDVI) y cada captura producen sus propias zonas: el mismo punto bajo en vigor aparece varias
veces (por índice y por capturas que se solapan). Aquí se agrupan las zonas cuyos polígonos se solapan al menos
`SOLAPE_MINIMO` del área de la menor y se reemplazan por una sola zona con la envolvente convexa de todas.
La envolvente puede sobreestimar el área cuando las zonas fusionadas solo se solapan en parte: es una estimación.
"""
from __future__ import annotations

import math

import numpy as np

METROS_POR_GRADO = 111320.0
SOLAPE_MINIMO = 0.7  # (0,5 y 0,6 juntaban las seis zonas del vuelo real en una; 0,7 deja dos) fracción del área de la zona menor; provisional, calibrar con inspección en campo


def _a_metros(poligono, lat0, kx):
    return [((lon) * kx, (lat - lat0) * METROS_POR_GRADO) for lat, lon in poligono]


def _casco(puntos):
    pts = sorted(set((round(x, 6), round(y, 6)) for x, y in puntos))
    if len(pts) <= 2:
        return pts

    def cruz(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    def mitad(ps):
        s = []
        for p in ps:
            while len(s) >= 2 and cruz(s[-2], s[-1], p) <= 0:
                s.pop()
            s.append(p)
        return s[:-1]
    return mitad(pts) + mitad(pts[::-1])


def _area(p):
    return abs(sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(p, p[1:] + p[:1]))) / 2


def _recortar(sujeto, clip):
    """Sutherland-Hodgman: `clip` convexo y en sentido antihorario."""
    def dentro(p, a, b):
        return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= 0

    def cruce(p, q, a, b):
        x1, y1, x2, y2, x3, y3, x4, y4 = *p, *q, *a, *b
        d = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
        t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / d
        return (x1 + t * (x2 - x1), y1 + t * (y2 - y1))
    salida = sujeto
    for a, b in zip(clip, clip[1:] + clip[:1]):
        entrada, salida = salida, []
        if not entrada:
            break
        s = entrada[-1]
        for e in entrada:
            if dentro(e, a, b):
                if not dentro(s, a, b):
                    salida.append(cruce(s, e, a, b))
                salida.append(e)
            elif dentro(s, a, b):
                salida.append(cruce(s, e, a, b))
            s = e
    return salida


def solape(a, b):
    """Fracción del área de la menor cubierta por la otra (polígonos en metros; se usa su casco convexo)."""
    ca, cb = _casco(a), _casco(b)
    if len(ca) < 3 or len(cb) < 3:
        return 0.0
    menor = min(_area(ca), _area(cb))
    if menor <= 0:
        return 0.0
    interseccion = _recortar(ca, cb)
    return min(1.0, _area(interseccion) / menor) if len(interseccion) >= 3 else 0.0


def _centroide(p):
    dobles = sx = sy = 0.0
    for a, b in zip(p, p[1:] + p[:1]):
        prod = a[0] * b[1] - b[0] * a[1]
        dobles += prod
        sx += (a[0] + b[0]) * prod
        sy += (a[1] + b[1]) * prod
    return (sx / (3 * dobles), sy / (3 * dobles))


def _antihorario(p):
    return p if sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(p, p[1:] + p[:1])) > 0 else p[::-1]


def fusionar(zonas, solape_minimo=SOLAPE_MINIMO):
    """Devuelve las zonas fusionadas (ordenadas por `_peso` descendente) con `indicesAfectados`, `capturasIds`
    y `detecciones` (cuántas zonas candidatas se unieron). Las zonas sin polígono no se fusionan."""
    zonas = list(zonas)
    con_poligono = [i for i, z in enumerate(zonas) if z.get('poligono') and len(z['poligono']) >= 3]
    padre = list(range(len(zonas)))

    def raiz(i):
        while padre[i] != i:
            padre[i] = padre[padre[i]]
            i = padre[i]
        return i

    if con_poligono:
        lat0 = float(np.mean([v[0] for i in con_poligono for v in zonas[i]['poligono']]))
        kx = METROS_POR_GRADO * math.cos(math.radians(lat0))
        metros = {i: _a_metros(zonas[i]['poligono'], lat0, kx) for i in con_poligono}
        for n, i in enumerate(con_poligono):
            for j in con_poligono[n + 1:]:
                if solape(metros[i], metros[j]) >= solape_minimo:
                    padre[raiz(j)] = raiz(i)
    grupos: dict[int, list[int]] = {}
    for i in range(len(zonas)):
        grupos.setdefault(raiz(i), []).append(i)

    salida = []
    for miembros in grupos.values():
        zs = [zonas[i] for i in miembros]
        base = max(zs, key=lambda z: z.get('_peso', 0))
        mejores: dict[str, float] = {}
        for z in zs:
            if z['indice'] not in mejores or z['valor'] < mejores[z['indice']]:
                mejores[z['indice']] = z['valor']
        fusionada = {**base,
                     'indicesAfectados': [{'indice': k, 'valor': v} for k, v in mejores.items()],
                     'capturasIds': sorted({z['capturaId'] for z in zs}),
                     'detecciones': len(zs),
                     '_peso': max(z.get('_peso', 0) for z in zs)}
        if len(miembros) > 1 and all(i in con_poligono for i in miembros):
            casco = _antihorario(_casco([p for i in miembros for p in metros[i]]))
            cx, cy = _centroide(casco)
            fusionada['poligono'] = [[round(lat0 + y / METROS_POR_GRADO, 6), round(x / kx, 6)] for x, y in casco]
            fusionada['areaM2'] = round(_area(casco), 1)
            fusionada['ubicacionZona'] = {'lat': lat0 + cy / METROS_POR_GRADO, 'lon': cx / kx}
            origenes = {z.get('gsdOrigen') for z in zs}
            fusionada['gsdOrigen'] = 'nominal' if 'nominal' in origenes else base.get('gsdOrigen')
        salida.append(fusionada)
    return sorted(salida, key=lambda z: -z.get('_peso', 0))
