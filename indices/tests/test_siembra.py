from pydantic import ValidationError

from app.main import Siembra


def test_siembra_con_variedad_y_altura():
    s = Siembra(distSurcoM=2.0, distPlantaM=1.0, variedad="Castillo", alturaPlantaM=1.8)
    assert s.provisional is True and s.variedad == "Castillo" and s.alturaPlantaM == 1.8


def test_siembra_minima_sin_variedad_ni_altura():
    s = Siembra(distSurcoM=1.5, distPlantaM=1.2)
    assert s.variedad is None and s.alturaPlantaM is None


def test_siembra_rechaza_valores_invalidos():
    for campos in ({"distSurcoM": 0, "distPlantaM": 1}, {"distSurcoM": 2, "distPlantaM": -1},
                   {"distSurcoM": 2, "distPlantaM": 1, "alturaPlantaM": 0}):
        try:
            Siembra(**campos)
        except ValidationError:
            continue
        raise AssertionError(f"No rechazó {campos}")
