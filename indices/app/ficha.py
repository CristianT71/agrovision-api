"""Ficha de los TIFF utilizados: no completa metadatos con datos de la petición."""
from __future__ import annotations

from datetime import datetime, timezone
import math
from statistics import median
import re
import xml.etree.ElementTree as ET

import tifffile

from . import calibracion, geo, escala


def _campos_xmp(xmp: str) -> dict[str, str]:
    try:
        raiz = ET.fromstring(xmp.strip().strip('\x00'))
    except ET.ParseError:
        return {}
    campos = {}
    for nodo in raiz.iter():
        for clave, valor in nodo.attrib.items():
            campos[clave.rsplit('}', 1)[-1]] = valor
        if nodo.text and nodo.text.strip():
            campos[nodo.tag.rsplit('}', 1)[-1]] = nodo.text.strip()
    return campos


def _numero(valor):
    try:
        n = float(valor)
        return n if math.isfinite(n) else None
    except (TypeError, ValueError):
        return None


def _fecha(valor):
    if not isinstance(valor, str):
        return None
    # EXIF usa YYYY:MM:DD; no se presupone zona horaria cuando falta.
    valor = re.sub(r'^(\d{4}):(\d{2}):(\d{2})', r'\1-\2-\3', valor.strip())
    try:
        return datetime.fromisoformat(valor.replace('Z', '+00:00'))
    except ValueError:
        return None


def _coordenada(valor):
    """XMP GPS: decimal o grados,minutos con hemisferio."""
    if not isinstance(valor, str):
        return _numero(valor)
    texto = valor.strip().upper()
    signo = -1 if texto.endswith(('S', 'W')) else 1
    partes = texto.rstrip('NSEW').split(',')
    numeros = [_numero(p) for p in partes]
    if not 1 <= len(numeros) <= 3 or any(n is None for n in numeros):
        return None
    return signo * sum(n / (60 ** i) for i, n in enumerate(numeros))


def _gps_exif(valor):
    try:
        partes = [float(v[0]) / float(v[1]) if isinstance(v, tuple) else float(v) for v in valor]
        if len(partes) == 6:  # tifffile puede devolver los racionales aplanados
            partes = [partes[i] / partes[i + 1] for i in (0, 2, 4)]
        return sum(v / (60 ** i) for i, v in enumerate(partes)) if len(partes) == 3 else None
    except (TypeError, ValueError, ZeroDivisionError):
        return None


def leer(ruta) -> dict:
    """Un fallo de metadatos opcionales nunca impide calcular los índices."""
    salida = {"sensor": None, "resolucionPx": None, "alturaRelativaM": None,
              "fecha": None, "georreferencia": False}
    try:
        xmp = _campos_xmp(calibracion.leer_xmp(ruta))
    except Exception:
        xmp = {}
    salida['geo'] = geo.leer_geo(xmp)
    tags, exif, gps = {}, {}, {}
    try:
        with tifffile.TiffFile(ruta) as t:
            pagina = t.pages[0]
            salida['resolucionPx'] = (int(pagina.imagewidth), int(pagina.imagelength))
            for nombre in ('Model', 'DateTime', 'ExifTag', 'GPSTag'):
                tag = pagina.tags.get(nombre)
                if tag is not None:
                    tags[nombre] = tag.value
            exif = tags.get('ExifTag') if isinstance(tags.get('ExifTag'), dict) else {}
            gps = tags.get('GPSTag') if isinstance(tags.get('GPSTag'), dict) else {}
    except Exception:
        pass
    modelo = xmp.get('Model') or tags.get('Model') or xmp.get('SensorModel')
    salida['sensor'] = modelo.strip() or None if isinstance(modelo, str) else None
    salida['alturaRelativaM'] = _numero(xmp.get('RelativeAltitude'))
    salida['fecha'] = next((f for v in (xmp.get('DateTimeOriginal'), exif.get('DateTimeOriginal'),
                                       xmp.get('CreateDate'), tags.get('DateTime'))
                            if (f := _fecha(v)) is not None), None)
    lat = _coordenada(xmp.get('GpsLatitude') or xmp.get('GPSLatitude'))
    lon = _coordenada(xmp.get('GpsLongitude') or xmp.get('GpsLongtitude') or xmp.get('GPSLongitude'))
    if lat is None or lon is None:
        lat, lon = _gps_exif(gps.get('GPSLatitude')), _gps_exif(gps.get('GPSLongitude'))
    salida['georreferencia'] = (lat is not None and lon is not None
                                and -90 <= lat <= 90 and -180 <= lon <= 180)
    return salida


def resumir(capturas: list[dict], pares=None) -> dict:
    metadatos = [m for c in capturas for m in c['metadatos']]
    sensores = sorted({m['sensor'] for m in metadatos if m['sensor'] is not None})
    resoluciones = sorted({m['resolucionPx'] for m in metadatos if m['resolucionPx'] is not None})
    alturas = [m['alturaRelativaM'] for m in metadatos if m['alturaRelativaM'] is not None]
    fechas = [m['fecha'] for m in metadatos if m['fecha'] is not None]
    # Fechas con y sin huso no son comparables sin inventar una zona horaria.
    comparables = fechas and len({f.tzinfo is not None for f in fechas}) == 1
    if comparables and fechas[0].tzinfo is not None:
        fechas = [f.astimezone(timezone.utc) for f in fechas]
    # Una referencia por captura; en el servicio corresponde a la banda NIR.
    referencias = [c.get('geo', {}) for c in capturas]
    nominales = [g * 100 for m in referencias
               if (g := geo.gsd_m_px(m.get('alturaRelativaM'), m.get('focalPx'))) is not None]
    escalas = [g * 100 for c in capturas
               if (g := escala.gsd_para_captura(c.get('geo', {}), c.get('gsdEfectivoM'))[0]) is not None]
    efectivos = [c['gsdEfectivoM'] * 100 for c in capturas if c.get('gsdEfectivoM') is not None]
    pares = pares or []
    razones = [p['razon'] for p in pares if p['valido']]
    def estadisticas(valores):
        return {'min': min(valores), 'max': max(valores), 'media': sum(valores) / len(valores)} if valores else None
    estados_rtk = [m['rtk'] for m in referencias if m.get('rtk') is not None]
    return {
        'sensores': sensores or None,
        'resolucionesPx': [{'ancho': w, 'alto': h} for w, h in resoluciones] or None,
        'bandasDisponibles': sorted({b for c in capturas for b in c['bandas']}) or None,
        'alturaRelativaM': {'min': min(alturas), 'max': max(alturas)} if alturas else None,
        'capturasUsadas': len(capturas),
        'capturasConGeorreferencia': sum(any(m['georreferencia'] for m in c['metadatos']) for c in capturas),
        'calibracion': {'calibradas': sum(c['calibrada'] for c in capturas),
                        'sinCalibrar': sum(not c['calibrada'] for c in capturas)},
        'fechaCaptura': {'min': min(fechas).isoformat(), 'max': max(fechas).isoformat()} if comparables else None,
        'gsdCmPx': {'min': min(escalas), 'max': max(escalas), 'media': sum(escalas) / len(escalas)} if escalas else None,
        'gsdNominalCmPx': estadisticas(nominales),
        'gsdEfectivoCmPx': {**estadisticas(efectivos), 'capturasConEfectivo': len(efectivos)} if efectivos else None,
        'razonEfectivoNominal': {'mediana': median(razones), 'min': min(razones), 'max': max(razones)} if razones else None,
        'paresValidos': len(razones), 'paresTotales': len(pares),
        'georreferenciacion': {
            'metodo': 'cenital_terreno_plano',
            'capturasGeorreferenciables': sum(bool(m.get('georreferenciable')) for m in referencias),
            'capturasUsadas': len(capturas),
            'rtkPct': 100 * sum(estados_rtk) / len(estados_rtk) if estados_rtk else None,
        },
    }
