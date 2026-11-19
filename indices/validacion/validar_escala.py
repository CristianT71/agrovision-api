"""Contrasta la escala nominal con traslación de textura y GPS de TIFF NIR."""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

import numpy as np
import tifffile

from app import calibracion, ficha, geo, escala


def comparar(a, b):
    try:
        capturas = [{'id': c['ruta'].name, 'geo': c['geo'],
                     'imagen': tifffile.imread(c['ruta']).squeeze()} for c in (a, b)]
        par = escala.gsd_efectivo_pares(capturas)['pares'][0]
    except Exception as error:
        return {'descartado': True, 'motivo': f'No se pudieron leer las imágenes: {type(error).__name__}.'}
    return {**par, 'descartado': not par['valido'],
            'desplazamientoPx': par['modulo'],
            'gsdEfectivoCm': par['gsdEfectivoM'] * 100 if par['gsdEfectivoM'] is not None else None,
            'gsdNominalCm': par['gsdNominalM'] * 100 if par['gsdNominalM'] is not None else None,
            'sentidoCoincide': par['errorAngularGrados'] <= 15 if par['errorAngularGrados'] is not None else None}


def resumir(pares):
    validos = [p for p in pares if not p['descartado']]
    razones = [p['razon'] for p in validos]
    mediana = float(np.median(razones)) if validos else None
    dispersion = float(np.median(np.abs(np.asarray(razones) - mediana))) if validos else None
    angular = float(np.median([p['errorAngularGrados'] for p in validos])) if validos else None
    coherente = len(validos) >= 8 and 0.9 <= mediana <= 1.1
    veredicto = ('escala coherente' if dispersion <= 0.05 else 'escala variable: usar GSD efectivo local') if coherente else 'escala NO validada'
    return {'paresValidos': len(validos), 'paresDescartados': len(pares) - len(validos),
            'razonMediana': mediana, 'razonMin': min(razones) if validos else None,
            'razonMax': max(razones) if validos else None,
            'errorAngularMaximoGrados': max(p['errorAngularGrados'] for p in validos) if validos else None,
            'dispersionMAD': dispersion, 'errorAngularMedianoGrados': angular,
            'veredicto': veredicto
                         + f'; razón mediana={mediana}; MAD={dispersion}; pares válidos={len(validos)}; error angular mediano={angular}°'}


def cargar_capturas(carpeta):
    capturas, omitidas = [], []
    for ruta in sorted(carpeta.iterdir()):
        if ruta.suffix.lower() not in ('.tif', '.tiff'):
            continue
        try:
            campos = ficha._campos_xmp(calibracion.leer_xmp(ruta))
            # Los archivos almacenados tienen UUID: la banda debe identificarse por XMP.
            banda = campos.get('BandName', '').strip().upper()
            if banda != 'NIR':
                omitidas.append({'archivo': ruta.name, 'motivo': 'Banda distinta de NIR o BandName ausente.'})
                continue
            metadatos = ficha.leer(ruta)
            if metadatos['fecha'] is None:
                omitidas.append({'archivo': ruta.name, 'motivo': 'Hora de captura ausente.'})
                continue
            capturas.append({'ruta': ruta, 'fecha': metadatos['fecha'], 'geo': metadatos['geo']})
        except Exception as error:
            omitidas.append({'archivo': ruta.name, 'motivo': f'TIFF ilegible: {type(error).__name__}.'})
    if len({c['fecha'].tzinfo is not None for c in capturas}) > 1:
        raise ValueError('Horas con y sin zona horaria: no se puede establecer el orden sin suposiciones.')
    return sorted(capturas, key=lambda c: c['fecha']), omitidas


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('vueloId')
    parser.add_argument('--raiz', type=Path, default=Path(os.environ.get('RAIZ_VUELOS', '/datos/vuelos')))
    args = parser.parse_args()
    if Path(args.vueloId).name != args.vueloId or args.vueloId in ('.', '..'):
        parser.error('Identificador de vuelo no válido.')
    carpeta = args.raiz / args.vueloId
    if not carpeta.is_dir():
        parser.error('No existe la carpeta del vuelo.')
    try:
        capturas, omitidas = cargar_capturas(carpeta)
    except ValueError as error:
        parser.error(str(error))
    pares = []
    # No unir capturas a ambos lados de una captura no cenital.
    for a, b in zip(capturas, capturas[1:]):
        if a['fecha'] == b['fecha']:
            pares.append({'primera': a['ruta'].name, 'segunda': b['ruta'].name,
                          'descartado': True, 'motivo': 'Horas iguales: orden indeterminado.'})
        else:
            pares.append(comparar(a, b))
    print('Par | estado | módulo 1/2 | módulo 1/4 | módulo 1/8 | coincide | razón | error angular ° | motivo')
    for i, p in enumerate(pares, 1):
        valores = [p.get('desplazamientos', {}).get(e, {}).get('modulo') for e in (2, 4, 8)]
        valores += [p.get('coincide'), p.get('razon'), p.get('errorAngularGrados')]
        print(f"{i} | {'descartado' if p['descartado'] else 'válido'} | "
              + ' | '.join(str(v) if v is not None else 'null' for v in valores)
              + ' | ' + (p.get('motivo') or ''))
    print(json.dumps({**resumir(pares),
                      'pares': pares, 'archivosOmitidos': omitidas,
                      'advertencia': geo.ADVERTENCIA}, ensure_ascii=False, indent=2, allow_nan=False))


if __name__ == '__main__':
    main()
