"""Explora rasgos por recorte; no valida el conteo ni identifica especies."""
import argparse
import csv
import json
import os
import sys
from pathlib import Path

import numpy as np

from app.copas import detectar_copas

RASGOS = ('areaRegionM2', 'diametroM', 'solidez', 'excentricidad',
          'texturaNir', 'ndviMedio', 'contrasteMedio', 'numeroMaximos')
AVISO = ('Exploración, no validación: tres recortes no permiten generalizar. '
         'C frente a A+B compara pertenencia al recorte, no especie ni verdad por copa. '
         'Los umbrales candidatos no se aplican al detector.')


def valores(filas, rasgo):
    return np.asarray([f[rasgo] for f in filas
                       if f.get(rasgo) is not None and np.isfinite(f[rasgo])], dtype=float)


def estadisticas(datos):
    if not len(datos):
        return dict(n=0, mediana=None, p10=None, p90=None)
    p10, mediana, p90 = np.percentile(datos, [10, 50, 90])
    return dict(n=len(datos), mediana=float(mediana), p10=float(p10), p90=float(p90))


def separar(positivos, negativos):
    """AUC = P(C > AB) + 0,5 P(empate); sin matriz cuadrática."""
    positivos, negativos = np.asarray(positivos), np.asarray(negativos)
    resultado = dict(nC=len(positivos), nAB=len(negativos), auc=None, candidatos=[])
    if not len(positivos) or not len(negativos):
        return resultado
    ordenados = np.sort(negativos)
    izquierda = np.searchsorted(ordenados, positivos, side='left')
    derecha = np.searchsorted(ordenados, positivos, side='right')
    resultado['auc'] = float(np.mean((izquierda+derecha)/2)/len(negativos))
    # Orden estadístico inclusivo: garantiza al menos 90%, aun con pocos datos/empates.
    cuantos = int(np.ceil(.9*len(positivos)))
    c = np.sort(positivos)
    for operador, umbral in (('>=', c[len(c)-cuantos]), ('<=', c[cuantos-1])):
        marcadas = positivos >= umbral if operador == '>=' else positivos <= umbral
        perdidas = negativos >= umbral if operador == '>=' else negativos <= umbral
        resultado['candidatos'].append(dict(
            operador=operador, umbral=float(umbral), cMarcadas=int(marcadas.sum()),
            cMarcadasPct=float(marcadas.mean()*100), abPerdidas=int(perdidas.sum()),
            abPerdidasPct=float(perdidas.mean()*100)))
    return resultado


def analizar(recortes):
    resumen = {etiqueta: {rasgo: estadisticas(valores(filas, rasgo)) for rasgo in RASGOS}
               for etiqueta, filas in recortes.items()}
    comparacion = {}
    if all(etiqueta in recortes for etiqueta in ('A', 'B', 'C')):
        for rasgo in RASGOS:
            comparacion[rasgo] = separar(valores(recortes['C'], rasgo),
                                        valores(recortes['A']+recortes['B'], rasgo))
    return dict(advertencia=AVISO, resumen=resumen, separacionCvsAB=comparacion,
                motivoSeparacion=None if comparacion else 'Se requieren etiquetas A, B y C.')


def tabla(resultado):
    print(AVISO, file=sys.stderr)
    print(f"{'Recorte':12} {'Rasgo':20} {'n':>5} {'mediana':>12} {'p10':>12} {'p90':>12}", file=sys.stderr)
    def formato(valor):
        return 'null' if valor is None else f'{valor:.5g}'
    for etiqueta, rasgos in resultado['resumen'].items():
        for rasgo, datos in rasgos.items():
            print(f"{etiqueta:12} {rasgo:20} {datos['n']:5} "
                  + ' '.join(f'{formato(datos[k]):>12}' for k in ('mediana', 'p10', 'p90')), file=sys.stderr)
    for rasgo, datos in resultado['separacionCvsAB'].items():
        print(f"{rasgo}: AUC (valores altos en C)={formato(datos['auc'])}; "
              f"nC={datos['nC']}, nAB={datos['nAB']}", file=sys.stderr)
        for candidato in datos['candidatos']:
            print(f"  {candidato['operador']} {candidato['umbral']:.6g}: "
                  f"C marcadas {candidato['cMarcadas']} ({candidato['cMarcadasPct']:.1f}%); "
                  f"A+B perdidas {candidato['abPerdidas']} ({candidato['abPerdidasPct']:.1f}%)", file=sys.stderr)
    if resultado['motivoSeparacion']:
        print(resultado['motivoSeparacion'], file=sys.stderr)


def recorte_argumento(texto):
    try:
        etiqueta, coordenadas = texto.split('=', 1)
        caja = tuple(int(v) for v in coordenadas.split(','))
        if not etiqueta.strip() or len(caja) != 4 or not (0 <= caja[0] < caja[2] and 0 <= caja[1] < caja[3]):
            raise ValueError
        return etiqueta.strip(), caja
    except ValueError:
        raise argparse.ArgumentTypeError('Use ETIQUETA=x0,y0,x1,y1, con enteros y rectángulo no vacío.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('vueloId')
    parser.add_argument('--captura', type=int, default=2, help='Índice NIR desde cero, ordenado por hora.')
    parser.add_argument('--recorte', type=recorte_argumento, action='append', required=True,
                        help='ETIQUETA=x0,y0,x1,y1; repetible, sin recortes predeterminados.')
    parser.add_argument('--csv', type=Path)
    parser.add_argument('--gsd-m', type=float, help='GSD medido explícito en m/px; si falta se calcula como contar_copas.')
    parser.add_argument('--raiz', type=Path, default=Path(os.environ.get('RAIZ_VUELOS', '/datos/vuelos')))
    args = parser.parse_args()
    if Path(args.vueloId).name != args.vueloId or args.vueloId in ('.', '..'):
        parser.error('Identificador de vuelo no válido.')
    if len(dict(args.recorte)) != len(args.recorte):
        parser.error('Las etiquetas de recorte no se pueden repetir.')
    try:
        # Reutiliza lectura/calibración y metadatos TIFF del servicio; no añade dependencias.
        from .contar_copas import cargar_capturas, leer, buscar_roja, gsd_local
        from app import calculo
        carpeta = args.raiz/args.vueloId
        capturas, omitidas = cargar_capturas(carpeta)
        if not 0 <= args.captura < len(capturas):
            raise ValueError('Índice de captura fuera de rango.')
        captura = capturas[args.captura]
        if not captura['geo'].get('georreferenciable'):
            raise ValueError('Cámara no cenital o geometría incompleta; no se inventan rasgos.')
        gsd, origen = (gsd_local(capturas, args.captura) if args.gsd_m is None
                       else (args.gsd_m, 'proporcionado'))
        nir = leer(captura['ruta'])
        roja = leer(buscar_roja(carpeta, captura))
        filas = (np.arange(nir.shape[0])*roja.shape[0]/nir.shape[0]).astype(int)
        columnas = (np.arange(nir.shape[1])*roja.shape[1]/nir.shape[1]).astype(int)
        ndvi = calculo.indice(nir, roja[np.ix_(filas, columnas)])
        recortes, detalle = {}, {}
        for _, caja in args.recorte:
            if caja[2] > nir.shape[1] or caja[3] > nir.shape[0]:
                raise ValueError('Recorte fuera de la imagen NIR.')
        # Una detección con contexto completo para todos los recortes, incluidos bordes.
        deteccion = detectar_copas(nir, ndvi, gsd, recorte=(0, 0, nir.shape[1], nir.shape[0]))
        for etiqueta, caja in args.recorte:
            def dentro(copa):
                return caja[0] <= copa['x'] < caja[2] and caja[1] <= copa['y'] < caja[3]
            recortes[etiqueta] = [dict(recorte=etiqueta, id=i, **copa)
                                  for i, copa in enumerate(deteccion['copas'], 1) if dentro(copa)]
            detalle[etiqueta] = dict(coordenadas=list(caja), conteo=len(recortes[etiqueta]),
                                     masasGrandes=[c for c in deteccion['regionesGrandes'] if dentro(c)])
        resultado = analizar(recortes)
        resultado.update(capturaId=captura['ruta'].name, captura=args.captura,
                         gsdM=gsd, gsdOrigen=origen, recortes=detalle,
                         archivosOmitidos=omitidas, parametros=deteccion['parametros'])
        if origen == 'nominal':
            resultado['advertenciaGsd'] = 'GSD nominal: comprobar escala antes de interpretar tamaños.'
            print(resultado['advertenciaGsd'], file=sys.stderr)
        if args.csv:
            with args.csv.open('w', newline='', encoding='utf-8') as archivo:
                campos = ('recorte', 'id', 'x', 'y')+RASGOS
                escritor = csv.DictWriter(archivo, fieldnames=campos, extrasaction='ignore')
                escritor.writeheader()
                for lista in recortes.values():
                    escritor.writerows({k: ('null' if fila.get(k) is None else fila[k])
                                        for k in campos} for fila in lista)
        tabla(resultado)
        print(json.dumps(resultado, ensure_ascii=False, allow_nan=False))
    except (ValueError, OSError, ImportError) as error:
        parser.error(str(error))


if __name__ == '__main__':
    main()
