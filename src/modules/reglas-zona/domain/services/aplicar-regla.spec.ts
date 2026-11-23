import { aplicarRegla, plantasEnRadio } from "./aplicar-regla";
import { FILAS_EJEMPLO } from "../testing/filas-ejemplo";

describe("aplicarRegla", () => {
    it("aplica la primera fila cuya severidad Y incidencia caben (bordes incluidos)", () => {
        expect(aplicarRegla(FILAS_EJEMPLO, 0, 0).orden).toBe(1);
        expect(aplicarRegla(FILAS_EJEMPLO, 10, 20).orden).toBe(1);
        expect(aplicarRegla(FILAS_EJEMPLO, 10.01, 20).orden).toBe(2);
        expect(aplicarRegla(FILAS_EJEMPLO, 10, 20.01).orden).toBe(2);
        expect(aplicarRegla(FILAS_EJEMPLO, 60, 70).orden).toBe(3);
        expect(aplicarRegla(FILAS_EJEMPLO, 100, 100).orden).toBe(4);
    });

    it("exige ambas condiciones: baja severidad con alta incidencia sube de fila", () => {
        expect(aplicarRegla(FILAS_EJEMPLO, 5, 65).orden).toBe(3);
    });

    it("ejemplo del contrato: sev 70, inc 55 → fila 4 (15–30 m)", () => {
        const fila = aplicarRegla(FILAS_EJEMPLO, 70, 55);
        expect(fila).toMatchObject({ orden: 4, radioMinM: 15, radioMaxM: 30 });
    });

    it("si ninguna fila cumple, devuelve la última (por orden, aunque lleguen desordenadas)", () => {
        const sinCobertura = FILAS_EJEMPLO.slice(0, 3).reverse();
        expect(aplicarRegla(sinCobertura, 90, 90).orden).toBe(3);
        expect(aplicarRegla([...FILAS_EJEMPLO].reverse(), 0, 0).orden).toBe(1);
    });
});

describe("plantasEnRadio", () => {
    it("round(π·r²·plantasPorHa/10000): 15 m y 30 m a 5000 pl/ha → 353 y 1414", () => {
        expect(plantasEnRadio(15, 5000)).toBe(353);
        expect(plantasEnRadio(30, 5000)).toBe(1414);
        expect(plantasEnRadio(0, 5000)).toBe(0);
    });
});
