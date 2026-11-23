"""Respaldo de los reportes de la app con lo que ve el dron. Datos SINTÉTICOS: ningún reporte real."""
import math

import numpy as np

from app import geo, respaldo

GSD = 0.05
LADO = 600  # 30 m × 30 m
GEO = dict(lat=1.89, lon=-76.09, cx=LADO / 2, cy=LADO / 2, yawGrados=30.0, pitchGrados=-90.0,
           alturaRelativaM=30.0, focalPx=600.0, georreferenciable=True)


def _bandas(mancha=None, semilla=0):
    """Hileras de copas (cada 1 m en hileras a 2 m). `mancha` = (x, y, radio_px): NDRE y GNDVI bajos ahí."""
    rng = np.random.default_rng(semilla)
    yy, xx = np.mgrid[0:LADO, 0:LADO]
    copa = np.zeros((LADO, LADO), bool)
    for cy in range(20, LADO, 40):
        for cx in range(10, LADO, 20):
            copa |= (yy - cy) ** 2 + (xx - cx) ** 2 <= 8 ** 2
    ruido = lambda: rng.normal(0, 0.01, (LADO, LADO))  # noqa: E731
    nir = np.where(copa, 0.5, 0.15) + ruido()
    red = np.where(copa, 0.05, 0.10) + ruido() / 5
    rededge = np.where(copa, 0.20, 0.12) + ruido() / 5
    green = np.where(copa, 0.08, 0.10) + ruido() / 5
    if mancha:
        x, y, r = mancha
        dentro = copa & ((yy - y) ** 2 + (xx - x) ** 2 <= r ** 2)
        rededge = np.where(dentro, 0.30, rededge)
        green = np.where(dentro, 0.15, green)
    return dict(green=green, red=red, rededge=rededge, nir=nir)


def _latlon(x, y):
    return geo.pixel_a_latlon(GEO, x, y, GSD)


def _evaluar(reportes, bandas, **extra):
    capturas = [dict(id='c1', geo=GEO, gsd=GSD, gsdOrigen='efectivo')] + extra.pop('capturas', [])
    return respaldo.evaluar(reportes, capturas, lambda cid: (bandas, LADO), siembra=dict(distSurcoM=2, distPlantaM=1),
                            **extra)


def _reporte(x, y, clase='Leaf rust', dias=2, revision=None):
    p = _latlon(x, y)
    return dict(lat=p['lat'], lon=p['lon'], clase=clase, origen='deteccion', diasDesdeVuelo=dias, revision=revision)


def test_inversa_de_la_proyeccion():
    for x, y in ((0, 0), (123.4, 456.7), (599, 3)):
        p = _latlon(x, y)
        assert np.allclose(geo.latlon_a_pixel(GEO, p['lat'], p['lon'], GSD), (x, y), atol=1e-3)


def test_tipo_de_clase_de_la_app():
    assert respaldo.tipo_de_clase('Leaf rust') == 'roya'
    assert respaldo.tipo_de_clase('Enfermedad_Roya') == 'roya'
    assert respaldo.tipo_de_clase('Cerscospora') == 'cercospora'
    assert respaldo.tipo_de_clase('Deficiencia_Potasio') == 'deficiencia'
    assert respaldo.tipo_de_clase(None) is None


def test_radio_de_30_plantas_no_de_4_m2():
    radio, origen = respaldo.radio_entorno(dict(distSurcoM=2, distPlantaM=1, provisional=True))
    assert math.isclose(radio, math.sqrt(60 / math.pi))  # ~4,4 m: ~60 m², no 4 m²
    assert '30 plantas' in origen and 'provisional' in origen
    assert respaldo.radio_entorno(radio_m=6)[0] == 6


def test_roya_sobre_mancha_es_consistente_y_lejos_no_consistente():
    bandas = _bandas(mancha=(150, 150, 90))
    r = _evaluar([_reporte(150, 150), _reporte(450, 450)], bandas)
    g = {gr['veredicto']: gr for gr in r['grupos']}
    assert r['resumen'] == {'consistente': 1, 'no_consistente': 1, 'no_concluyente': 0}
    m = g['consistente']['metricas']
    assert m['NDRE']['z'] <= -1 and m['GNDVI']['z'] <= -0.5 and m['NDRE']['percentil'] <= 10
    assert m['radioM'] == 4.4 and m['areaM2'] > 50
    assert 'Coherente con lo reportado' in g['consistente']['razon']
    assert g['no_consistente']['metricas']['NDRE']['z'] > -0.5
    # Nunca salen coordenadas de los reportes
    texto = str(r)
    assert '1.89' not in texto and '-76.09' not in texto


def test_planta_sana_invierte_la_expectativa():
    bandas = _bandas(mancha=(150, 150, 90))
    r = _evaluar([_reporte(150, 150, clase='Sana'), _reporte(450, 450, clase='Sana')], bandas)
    assert r['resumen'] == {'consistente': 1, 'no_consistente': 1, 'no_concluyente': 0}


def test_motivos_no_concluyente():
    bandas = _bandas(mancha=(150, 150, 90))
    lejos = geo.pixel_a_latlon(GEO, 5000, 5000, GSD)
    inclinada = dict(id='c2', geo=dict(GEO, lat=lejos['lat'], lon=lejos['lon'], pitchGrados=-60.0,
                                       georreferenciable=False), gsd=None, gsdOrigen=None)
    reportes = [
        dict(lat=None, lon=None, clase='Leaf rust'),                     # sin coordenadas
        dict(lat=lejos['lat'] + 0.01, lon=lejos['lon'], clase='Leaf rust'),  # fuera de las capturas
        dict(lat=lejos['lat'], lon=lejos['lon'], clase='Leaf rust'),     # solo una captura inclinada
        _reporte(5, 300),                                                # borde: el círculo se sale
        _reporte(150, 150, dias=90),                                     # muy lejos en el tiempo
        _reporte(150, 150, clase='Hormigas'),                            # sin firma esperada
    ]
    r = _evaluar(reportes, bandas, capturas=[inclinada])
    assert r['resumen']['no_concluyente'] == 6
    motivos = r['motivosNoConcluyente']
    for m in ('sin_coordenadas', 'fuera_capturas', 'captura_inclinada', 'borde', 'fecha_lejana', 'sin_firma'):
        assert motivos.get(respaldo.MOTIVOS[m]) == 1, m


def test_gsd_supuesto_y_pocos_pixeles():
    bandas = _bandas()
    capturas = [dict(id='c1', geo=GEO, gsd=GSD, gsdOrigen='supuesto')]
    r = respaldo.evaluar([_reporte(300, 300)], capturas, lambda cid: (bandas, LADO))
    assert r['motivosNoConcluyente'] == {respaldo.MOTIVOS['gsd_supuesto']: 1}
    r = _evaluar([_reporte(300, 300)], bandas, parametros=dict(radioEntornoM=0.5))
    assert r['motivosNoConcluyente'] == {respaldo.MOTIVOS['pocos_pixeles']: 1}


def test_seccion_fitosanitaria_hipotesis_y_verificada():
    bandas = _bandas(mancha=(150, 150, 90))
    r = _evaluar([_reporte(150, 150, revision=dict(estadoSolicitud='Enviada'))], bandas)
    f = r['fitosanitario']
    assert f['estado'] == 'hipotesis_sin_verificar'
    assert f['texto'].startswith('HIPÓTESIS sin verificar') and 'pendiente' in f['texto']
    assert f['pendientesPorSolicitud'] == {'Enviada': 1}
    assert respaldo.AVISO_PENDIENTE in r['avisos'] and respaldo.AVISO_PROPAGACION in r['avisos']
    resuelta = dict(estadoSolicitud='Resuelta', tipoResultado='Confirma diagnóstico IA', plagaIdentificada='Roya',
                    fechaResolucion='2026-11-02T10:00:00.000Z', agronomo='Ana')
    r = _evaluar([_reporte(150, 150, revision=resuelta)], bandas)
    f = r['fitosanitario']
    assert f['estado'] == 'verificado_por_agronomo' and f['hipotesisPendientes'] == 0
    assert f['verificados'][0]['conclusion'] == 'confirmada' and f['verificados'][0]['agronomo'] == 'Ana'
    assert 'Verificado por agrónomo Ana el 2026-11-02' in f['texto'] and 'pendiente' not in f['texto']
    assert respaldo.AVISO_PENDIENTE not in r['avisos'] and respaldo.AVISO_PROPAGACION in f['avisos']
    descartada = dict(resuelta, tipoResultado='Planta sana')
    assert respaldo.estado_fitosanitario(descartada)['conclusion'] == 'descartada'
    assert respaldo.estado_fitosanitario(None) == {'estado': 'hipotesis_sin_verificar',
                                                   'solicitud': 'sin solicitud al agrónomo'}


def test_sin_reportes_igual_trae_seccion_fitosanitaria():
    r = _evaluar([], _bandas())
    assert r['total'] == 0 and r['fitosanitario']['estado'] == 'sin_reportes'


def test_reglas_de_zona_se_citan_con_estado_y_fuente():
    bandas = _bandas(mancha=(150, 150, 90))
    reglas = [dict(tipo='roya', version=2, estado='borrador', calibrada=False, fuente='https://cenicafe.org/x.pdf',
                   cortesIncidenciaPct=[5, 15, 100]),
              dict(tipo='phoma', version=1, estado='borrador', calibrada=False)]
    r = _evaluar([_reporte(150, 150)], bandas, reglas=reglas)
    assert [x['tipo'] for x in r['reglas']] == ['roya']  # solo las de las clases reportadas
    assert r['reglas'][0]['nota'].startswith('Borrador sin aprobar') and r['reglas'][0]['fuente']
    assert r['grupos'][0]['regla'] == 'roya v2 (borrador, sin calibrar)'
    assert 'ni se usan para decidir el veredicto' in r['notaReglas']


def test_integracion_main_expone_respaldo_app():
    from pathlib import Path
    from tempfile import TemporaryDirectory
    from unittest.mock import patch
    from app import main
    vuelo = '00000000-0000-0000-0000-000000000002'
    bandas = _bandas(mancha=(150, 150, 90))
    meta = dict(geo=GEO, fecha=None, resolucionPx=(LADO, LADO))
    with TemporaryDirectory() as d:
        (Path(d) / vuelo).mkdir()
        p = main.Peticion(vueloId=vuelo, siembra=main.Siembra(distSurcoM=2, distPlantaM=1),
                          capturas=[main.Captura(id='c1', bandas={b: f'c1-{b}' for b in main.BANDAS})],
                          reportesApp=[main.ReporteApp(**_reporte(150, 150))])
        with patch.object(main, 'RAIZ', Path(d)), \
             patch.object(main, 'ruta_archivo', side_effect=lambda v, a: a), \
             patch.object(main, 'leer_banda', side_effect=lambda v, a: (bandas[a.split('-')[1]], True)), \
             patch.object(main.ficha, 'leer', return_value=meta), \
             patch.object(main.ficha, 'resumir', return_value={}), \
             patch.object(main.imagenes, 'mapa_calor', return_value=''), \
             patch.object(main.imagenes, 'mapa_copas', return_value=''):
            r = main.analizar_peticion(p, incluir_mapas=False)
        assert r['respaldoApp']['resumen']['consistente'] == 1
        p.reportesApp = None
        with patch.object(main, 'RAIZ', Path(d)), \
             patch.object(main, 'ruta_archivo', side_effect=lambda v, a: a), \
             patch.object(main, 'leer_banda', side_effect=lambda v, a: (bandas[a.split('-')[1]], True)), \
             patch.object(main.ficha, 'leer', return_value=meta), \
             patch.object(main.ficha, 'resumir', return_value={}):
            assert main.analizar_peticion(p, incluir_mapas=False)['respaldoApp'] is None
