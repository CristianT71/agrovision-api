from copy import deepcopy
from app.comparacion import comparar_analisis, solape_huellas


def vuelo(media=.5):
    return dict(vueloId='uno', nombre=None, fecha='2026-09-15',
        huella=dict(latMin=4, latMax=4.01, lonMin=-74, lonMax=-73.99),
        analisis=dict(capturasUsadas=4,
            indices=[dict(nombre=n, media=media, mediana=media, areaBajoUmbralPct=media*100)
                     for n in ('NDVI', 'NDRE', 'GNDVI')],
            vigor=dict(bajoPct=10, medioPct=30, altoPct=60), cobertura=dict(pct=80),
            zonasCandidatas=[{}], plantas=dict(densidadMediaPlantasHa=1000),
            ficha=dict(georreferenciacion=dict(capturasGeorreferenciables=4),
                       calibracion=dict(sinCalibrar=0), gsdCmPx=dict(media=2),
                       alturaRelativaM=dict(min=30, max=30))))


def test_deltas_conocidos_y_no_mutacion():
    a, b = vuelo(), vuelo(.75)
    b['fecha'] = '2026-09-17'
    b['analisis']['vigor']['altoPct'] = 70
    b['analisis']['cobertura']['pct'] = 90
    b['analisis']['zonasCandidatas'].append({})
    b['analisis']['plantas']['densidadMediaPlantasHa'] = 1200
    original = deepcopy(b)
    r = comparar_analisis(a, b)
    assert r['comparable'] and r['intervaloDias'] == 2
    assert r['indices']['NDVI']['deltaMedia'] == .25
    assert r['indices']['NDVI']['deltaMediana'] == .25
    assert r['indices']['NDVI']['deltaAreaBajoUmbralPct'] == 25
    assert r['indices']['NDVI']['significativo'] is None
    assert r['vigor']['altoPct'] == 10 and r['cobertura'] == 10
    assert r['zonasCandidatas'] == dict(a=1, b=2, delta=1)
    assert r['plantas']['deltaDensidadPlantasHa'] == 200
    assert b == original


def test_guardas_y_deltas_nulos():
    for modo in ('sin_solape', 'sin_huella', 'sin_cenitales', 'sin_indice'):
        a, b = vuelo(), vuelo()
        if modo == 'sin_solape':
            b['huella'].update(latMin=5, latMax=5.01)
        elif modo == 'sin_huella':
            a['huella'] = None
        elif modo == 'sin_cenitales':
            b['analisis']['ficha']['georreferenciacion']['capturasGeorreferenciables'] = 0
        else:
            b['analisis']['indices'] = []
        r = comparar_analisis(a, b)
        assert not r['comparable'] and r['motivos']
        assert all(r[k] is None for k in ('indices', 'vigor', 'cobertura', 'zonasCandidatas'))
        assert r['plantas']['deltaDensidadPlantasHa'] is None


def test_advertencias_y_fechas():
    a, b = vuelo(), vuelo()
    b['analisis']['ficha']['calibracion']['sinCalibrar'] = 1
    b['analisis']['ficha']['gsdCmPx']['media'] = 3
    b['analisis']['ficha']['alturaRelativaM']['max'] = 45
    b['analisis']['capturasUsadas'] = 2
    a['fecha'] = b['fecha'] = None
    r = comparar_analisis(a, b)
    assert r['comparable'] and r['intervaloDias'] is None
    texto = ' '.join(r['advertencias'])
    assert all(v in texto for v in ('Calibración', 'GSD', 'altura relativa', 'Muestreo', 'no se puede calcular el intervalo'))
    assert comparar_analisis(vuelo(), vuelo())['intervaloDias'] == 0


def test_ruido_y_plantas_ausentes():
    a, b = vuelo(), vuelo(.75)
    for ruido, esperado in ((.1, True), (.25, False), (.3, False)):
        assert comparar_analisis(a, b, {'ruidoMinimo': ruido})['indices']['NDVI']['significativo'] is esperado
    b['analisis'].pop('plantas')
    assert comparar_analisis(a, b)['plantas']['deltaDensidadPlantasHa'] is None
    b['analisis']['indices'][0]['media'] = None
    assert comparar_analisis(a, b, {'ruidoMinimo': .1})['indices']['NDVI']['significativo'] is None


def test_solape_y_parametros():
    a = dict(latMin=0, latMax=2, lonMin=0, lonMax=2)
    b = dict(latMin=1, latMax=3, lonMin=0, lonMax=2)
    assert solape_huellas(a, b) == .5
    assert solape_huellas(a, dict(a, latMax=0)) is None
    for p in ({'ruidoMinimo': -1}, {'ruidoMinimo': float('nan')}, {'solapeMinimo': 2}):
        try:
            comparar_analisis(vuelo(), vuelo(), p)
        except ValueError:
            pass
        else:
            assert False, 'Debe rechazar parámetros inválidos'
