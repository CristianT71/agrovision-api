"""Fusión de zonas candidatas que son el mismo sitio."""
from app import zonas

LAT, LON = 1.89, -76.09
M = 1 / 111320.0


def _cuadro(norte, este, lado=10.0):
    """Polígono [[lat, lon]] de un cuadrado de `lado` m con esquina (norte, este) en metros desde el origen."""
    return [[LAT + norte * M, LON + este * M], [LAT + norte * M, LON + (este + lado) * M],
            [LAT + (norte + lado) * M, LON + (este + lado) * M], [LAT + (norte + lado) * M, LON + este * M]]


def _zona(id_, indice, valor, poligono, peso=1.0, captura="c1"):
    return {'id': id_, 'indice': indice, 'valor': valor, 'areaPct': 5.0, 'capturaId': captura, '_peso': peso,
            'poligono': poligono, 'areaM2': 100.0, 'ubicacionZona': {'lat': LAT, 'lon': LON}, 'gsdOrigen': 'efectivo'}


def test_mismo_sitio_con_dos_indices_se_fusiona_en_una_zona():
    p = _cuadro(0, 0)
    r = zonas.fusionar([_zona('a', 'NDVI', 0.2, p, 2.0), _zona('b', 'GNDVI', 0.25, p, 1.0)])
    assert len(r) == 1 and r[0]['detecciones'] == 2
    assert {i['indice'] for i in r[0]['indicesAfectados']} == {'NDVI', 'GNDVI'}
    assert r[0]['indice'] == 'NDVI'                         # manda la de mayor peso
    assert abs(r[0]['areaM2'] - 100.0) < 1.0                # casco de dos polígonos iguales = el mismo


def test_zonas_separadas_no_se_fusionan():
    r = zonas.fusionar([_zona('a', 'NDVI', 0.2, _cuadro(0, 0)), _zona('b', 'NDVI', 0.2, _cuadro(0, 50))])
    assert len(r) == 2 and all(z['detecciones'] == 1 for z in r)


def test_solape_menor_al_minimo_no_fusiona_y_mayor_si():
    a = _cuadro(0, 0)
    poco = _cuadro(0, 7)   # 30 % de solape con a
    mucho = _cuadro(0, 4)  # 60 % de solape con a
    assert len(zonas.fusionar([_zona('a', 'NDVI', .2, a), _zona('b', 'NDRE', .2, poco)])) == 2
    assert len(zonas.fusionar([_zona('a', 'NDVI', .2, a), _zona('b', 'NDRE', .2, mucho)])) == 1


def test_zona_pequena_dentro_de_otra_grande_se_fusiona():
    r = zonas.fusionar([_zona('g', 'NDRE', .2, _cuadro(0, 0, 30), 3.0), _zona('p', 'NDVI', .2, _cuadro(5, 5, 8), 1.0)])
    assert len(r) == 1 and abs(r[0]['areaM2'] - 900.0) < 5.0


def test_fusion_en_cadena_une_a_las_tres():
    r = zonas.fusionar([_zona('a', 'NDVI', .2, _cuadro(0, 0)), _zona('b', 'NDRE', .2, _cuadro(0, 4)),
                        _zona('c', 'GNDVI', .2, _cuadro(0, 8))])
    assert len(r) == 1 and r[0]['detecciones'] == 3


def test_centroide_de_la_fusionada_esta_en_el_centro_del_casco():
    r = zonas.fusionar([_zona('a', 'NDVI', .2, _cuadro(0, 0)), _zona('b', 'NDRE', .2, _cuadro(0, 4))])
    c = r[0]['ubicacionZona']
    assert abs((c['lon'] - LON) / M - 7.0) < 0.3 and abs((c['lat'] - LAT) / M - 5.0) < 0.3


def test_zonas_sin_poligono_se_conservan_y_no_se_fusionan():
    sin = {'id': 's', 'indice': 'NDVI', 'valor': 0.3, 'areaPct': 2.0, 'capturaId': 'c9', '_peso': 0.5, 'poligono': None}
    r = zonas.fusionar([_zona('a', 'NDVI', .2, _cuadro(0, 0)), sin])
    assert len(r) == 2 and r[-1]['id'] == 's' and r[-1]['detecciones'] == 1


def test_orden_por_peso_y_valor_minimo_por_indice():
    p = _cuadro(0, 0)
    r = zonas.fusionar([_zona('a', 'NDVI', 0.30, p, 1.0), _zona('b', 'NDVI', 0.18, p, 5.0), _zona('c', 'NDRE', 0.1, _cuadro(0, 80), 2.0)])
    assert r[0]['_peso'] == 5.0 and r[1]['_peso'] == 2.0
    assert [i for i in r[0]['indicesAfectados'] if i['indice'] == 'NDVI'][0]['valor'] == 0.18
