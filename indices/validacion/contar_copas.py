"""Dibuja copas sobre NIR para comparar con un conteo manual en campo."""
import argparse
import json
import os
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

from app import calculo, calibracion, copas, escala, ficha
from .validar_escala import cargar_capturas


def leer(ruta):
    # Pillow conserva los valores del TIFF monobanda sin normalizarlos.
    with Image.open(ruta) as imagen:
        a = np.asarray(imagen).copy()
    if a.ndim == 3:
        a = a[..., 0] if a.shape[-1] <= 4 else a[0]
    parametros = calibracion.parametros(calibracion.leer_xmp(ruta))
    return calibracion.calibrar(a, parametros) if parametros is not None else a


def buscar_roja(carpeta, captura):
    candidatas = []
    for ruta in sorted(carpeta.iterdir()):
        if ruta.suffix.lower() not in ('.tif', '.tiff'):
            continue
        campos = ficha._campos_xmp(calibracion.leer_xmp(ruta))
        if campos.get('BandName', '').strip().upper() == 'RED':
            if ficha.leer(ruta)['fecha'] == captura['fecha']:
                candidatas.append(ruta)
    if len(candidatas) != 1:
        raise ValueError('No hay una única banda roja con la misma hora; no se inventa el emparejamiento.')
    return candidatas[0]


def gsd_local(capturas, indice):
    # Solo vecinas inmediatas, sin saltar cámaras inclinadas ni horas repetidas.
    fechas = [c['fecha'] for c in capturas]
    repetidas = {f for f in fechas if fechas.count(f) > 1}
    vecinas = []
    for c in capturas[max(0, indice-1):indice+2]:
        referencia = c['geo']
        if c['fecha'] in repetidas:
            referencia = {**referencia, 'georreferenciable': False}
        vecinas.append(dict(id=c['ruta'].name, geo=referencia,
                            imagen=lambda ruta=c['ruta']: leer(ruta)))
    resultado = escala.gsd_efectivo_pares(vecinas)
    elegida = next(c for c in resultado['capturas'] if c['id'] == capturas[indice]['ruta'].name)
    return escala.gsd_para_captura(capturas[indice]['geo'], elegida['gsdEfectivoM'])


def dibujar(nir, resultado, gsd, salida):
    recorte = resultado.get('recorte')
    x0, y0 = recorte[:2] if recorte else (0, 0)
    if recorte:
        nir = nir[y0:recorte[3], x0:recorte[2]]
    finitos = nir[np.isfinite(nir)]
    bajo, alto = np.percentile(finitos, [1, 99]) if finitos.size else (0, 1)
    gris = np.clip((np.nan_to_num(nir, nan=float(bajo))-bajo)/max(float(alto-bajo), 1e-12), 0, 1)
    imagen = Image.fromarray((gris*255).astype(np.uint8)).convert('RGB')
    ancho = min(1300, imagen.width)
    factor = ancho/imagen.width
    imagen = imagen.resize((ancho, round(imagen.height*factor)))
    dibujo = ImageDraw.Draw(imagen)
    for numero, copa in enumerate(resultado['copas'], 1):
        x, y = (copa['x']-x0)*factor, (copa['y']-y0)*factor
        radio = copa['diametroM']/(2*gsd)*factor
        color = '#ff9933' if copa['fusionada'] else '#00ff88'
        dibujo.ellipse((x-radio, y-radio, x+radio, y+radio), outline=color, width=2)
        dibujo.text((x+3, y+3), str(numero), fill=color)
    for numero, copa in enumerate(resultado.get('copasAtipicas', []), 1):
        x, y = (copa['x']-x0)*factor, (copa['y']-y0)*factor
        radio = copa['diametroM']/(2*gsd)*factor
        caja = (x-radio, y-radio, x+radio, y+radio)
        for angulo in range(0, 360, 30):
            dibujo.arc(caja, angulo, angulo+18, fill='#aaaaaa', width=3)
        dibujo.text((x+3, y+3), f'A{numero}', fill='#aaaaaa')
    for masa in resultado.get('regionesGrandes', []):
        x, y = (masa['x']-x0)*factor, (masa['y']-y0)*factor
        radio = masa['diametroM']/(2*gsd)*factor
        dibujo.ellipse((x-radio, y-radio, x+radio, y+radio), outline='#999999', width=3)
    borde = 0 if recorte else resultado['parametros']['copaMinM']/(2*gsd)*factor
    if imagen.width > 2*borde and imagen.height > 2*borde:
        dibujo.rectangle((borde, borde, imagen.width-borde, imagen.height-borde), outline='cyan')
    dibujo.rectangle((0, 0, min(ancho, 650), 20), fill='black')
    dibujo.text((5, 4), f"Copas: {resultado['conteo']} | verde: copa | naranja: fusionada | gris: masa/atipica (punteada)", fill='white')
    imagen.save(salida, format='PNG')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('vueloId')
    parser.add_argument('--captura', type=int, help='Índice desde cero, por hora NIR.')
    parser.add_argument('--recorte', help='x0,y0,x1,y1 en píxeles NIR originales; extremo final excluido.')
    parser.add_argument('--parametros', type=Path, help='JSON de parámetros; umbrales provisionales.')
    parser.add_argument('--salida', type=Path, default=Path('/tmp/copas.png'))
    parser.add_argument('--raiz', type=Path, default=Path(os.environ.get('RAIZ_VUELOS', '/datos/vuelos')))
    args = parser.parse_args()
    if Path(args.vueloId).name != args.vueloId or args.vueloId in ('.', '..'):
        parser.error('Identificador de vuelo no válido.')
    carpeta = args.raiz/args.vueloId
    try:
        capturas, omitidas = cargar_capturas(carpeta)
        indice = args.captura
        if indice is None:
            indice = next((i for i, c in enumerate(capturas) if c['geo'].get('georreferenciable')), None)
        if indice is None or not 0 <= indice < len(capturas):
            raise ValueError('No hay captura cenital elegible o el índice está fuera de rango.')
        captura = capturas[indice]
        if not captura['geo'].get('georreferenciable'):
            print(json.dumps(dict(capturaId=captura['ruta'].name, conteo=None,
                                  motivo='Cámara no cenital o geometría incompleta.'), ensure_ascii=False))
            return
        gsd, origen = gsd_local(capturas, indice)
        nir = leer(captura['ruta'])
        roja = leer(buscar_roja(carpeta, captura))
        # Llevar rojo a la rejilla NIR: las coordenadas y el GSD siempre son NIR.
        filas = (np.arange(nir.shape[0])*roja.shape[0]/nir.shape[0]).astype(int)
        cols = (np.arange(nir.shape[1])*roja.shape[1]/nir.shape[1]).astype(int)
        ndvi = calculo.indice(nir, roja[np.ix_(filas, cols)])
        recorte = tuple(int(v) for v in args.recorte.split(',')) if args.recorte else None
        parametros = json.loads(args.parametros.read_text()) if args.parametros else None
        if parametros is not None and not isinstance(parametros, dict):
            raise ValueError('Los parámetros deben ser un objeto JSON.')
        resultado = copas.detectar_copas(nir, ndvi, gsd, parametros, recorte=recorte)
        dibujar(nir, resultado, gsd, args.salida)
        print(json.dumps({**resultado, 'capturaId': captura['ruta'].name, 'indice': indice,
                          'gsdM': gsd, 'gsdOrigen': origen, 'salida': str(args.salida),
                          'archivosOmitidos': omitidas,
                          'advertencias': [copas.ADVERTENCIA] + ([copas.ADVERTENCIA_GSD] if origen == 'nominal' else [])},
                         ensure_ascii=False, allow_nan=False))
    except (ValueError, OSError) as error:
        parser.error(str(error))


if __name__ == '__main__':
    main()
