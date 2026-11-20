"""Compara dos vuelos desde sus TIFF, sin HTTP; stdout contiene únicamente JSON."""
import argparse
import json
import sys

from app import calibracion, ficha
from app.main import BANDAS, RAIZ, UUID, Captura, Peticion, PeticionComparacion, comparar


def cargar_peticion(vuelo_id):
    if not UUID.fullmatch(vuelo_id):
        raise ValueError('Identificador de vuelo no válido.')
    grupos, nir = {}, []
    for ruta in sorted((RAIZ / vuelo_id).iterdir()):
        if ruta.suffix.lower() not in ('.tif', '.tiff'):
            continue
        campos = ficha._campos_xmp(calibracion.leer_xmp(ruta))
        banda = campos.get('BandName', '').strip().lower().replace(' ', '').replace('-', '')
        if banda not in BANDAS:
            continue
        fecha = ficha._fecha(campos.get('DateTimeOriginal') or campos.get('CreateDate'))
        if banda == 'nir':
            nir.append(Captura(id=ruta.stem, bandas={'nir': ruta.stem},
                               capturadoEn=fecha.isoformat() if fecha else None))
        if fecha is None:
            print(f'{ruta.name}: sin DateTimeOriginal ni CreateDate; no se empareja para analizar.', file=sys.stderr)
            continue
        bandas = grupos.setdefault(fecha, {})
        if banda in bandas:
            raise ValueError(f'Banda {banda} duplicada a la misma hora; emparejamiento ambiguo.')
        bandas[banda] = ruta.stem
    if len(nir) > 400:
        raise ValueError('El vuelo supera el límite de 400 capturasEscala; no se trunca la huella.')
    if len({f.tzinfo is not None for f in grupos}) > 1:
        raise ValueError('Horas con y sin zona horaria: no se inventa el orden.')
    completas = [(f, bandas) for f, bandas in sorted(grupos.items()) if all(b in bandas for b in BANDAS)]
    if not completas:
        raise ValueError('No hay capturas con las cuatro bandas y hora XMP común.')
    n = min(4, len(completas))
    posiciones = [round(i*(len(completas)-1)/(n-1)) for i in range(n)] if n > 1 else [0]
    elegidas = [Captura(id=completas[i][1]['nir'], bandas=completas[i][1],
                       capturadoEn=completas[i][0].isoformat()) for i in posiciones]
    return Peticion(vueloId=vuelo_id, capturas=elegidas, capturasEscala=nir)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('vueloIdA')
    parser.add_argument('vueloIdB')
    parser.add_argument('--fecha-a')
    parser.add_argument('--fecha-b')
    parser.add_argument('--ruido-minimo', type=float)
    args = parser.parse_args()
    try:
        resultado = comparar(PeticionComparacion(a=cargar_peticion(args.vueloIdA),
            b=cargar_peticion(args.vueloIdB), fechaA=args.fecha_a, fechaB=args.fecha_b,
            ruidoMinimo=args.ruido_minimo))
    except (ValueError, OSError) as error:
        parser.error(str(error))
    print(json.dumps(resultado, ensure_ascii=False, indent=2, allow_nan=False))
    print('Comparable: ' + ('sí' if resultado['comparable'] else 'no'), file=sys.stderr)
    for frase in resultado['motivos'] + resultado['advertencias'] + resultado['lecturaSugerida']:
        print(frase, file=sys.stderr)


if __name__ == '__main__':
    main()
