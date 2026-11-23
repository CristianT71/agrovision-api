import type { FilaRegla } from "../entities/regla-zona";
import { FILAS_EJEMPLO } from "../testing/filas-ejemplo";
import { validarFilas } from "./validar-filas";

const copia = () => FILAS_EJEMPLO.map((f) => ({ ...f }));
const con = (i: number, cambios: Partial<FilaRegla>) => {
    const filas = copia();
    filas[i] = { ...filas[i], ...cambios };
    return filas;
};

describe("validarFilas", () => {
    it("acepta la tabla de ejemplo y una sola fila 100/100", () => {
        expect(validarFilas(FILAS_EJEMPLO)).toEqual([]);
        expect(validarFilas([{ orden: 1, sevMax: 100, incMax: 100, radioMinM: 0, radioMaxM: 0 }])).toEqual([]);
    });

    it("exige entre 1 y 12 filas", () => {
        expect(validarFilas([])[0]).toMatch(/entre 1 y 12/);
        const trece = Array.from({ length: 13 }, (_, i) => ({
            orden: i + 1,
            sevMax: i === 12 ? 100 : i + 1,
            incMax: i === 12 ? 100 : i + 1,
            radioMinM: i,
            radioMaxM: i,
        }));
        expect(validarFilas(trece)[0]).toMatch(/entre 1 y 12/);
        expect(validarFilas(trece.slice(1).map((f, i) => ({ ...f, orden: i + 1 })))).toEqual([]);
    });

    it("exige orden consecutivo desde 1", () => {
        expect(validarFilas(con(0, { orden: 0 })).join()).toMatch(/orden debe ser consecutivo/);
        expect(validarFilas(con(2, { orden: 4 })).join()).toMatch(/Fila 3: el orden/);
        expect(validarFilas(con(1, { orden: 1 })).join()).toMatch(/Fila 2: el orden/);
    });

    it("exige sevMax e incMax en (0, 100]", () => {
        expect(validarFilas(con(0, { sevMax: 0 })).join()).toMatch(/sevMax debe estar en \(0, 100\]/);
        expect(validarFilas(con(0, { incMax: -1 })).join()).toMatch(/incMax debe estar en \(0, 100\]/);
        expect(validarFilas(con(3, { sevMax: 100.5 })).join()).toMatch(/sevMax debe estar/);
        expect(validarFilas(con(0, { sevMax: Number.NaN })).join()).toMatch(/sevMax debe estar/);
    });

    it("exige sevMax e incMax no decrecientes (iguales se permiten)", () => {
        expect(validarFilas(con(1, { sevMax: 5 })).join()).toMatch(/Fila 2: sevMax no puede ser menor/);
        expect(validarFilas(con(2, { incMax: 39 })).join()).toMatch(/Fila 3: incMax no puede ser menor/);
        expect(validarFilas(con(1, { sevMax: 10, incMax: 20 }))).toEqual([]);
    });

    it("exige que la última fila sea 100/100", () => {
        expect(validarFilas(con(3, { sevMax: 99 })).join()).toMatch(/última fila debe cubrir/);
        expect(validarFilas(con(3, { incMax: 90 })).join()).toMatch(/última fila debe cubrir/);
    });

    it("exige radioMinM <= radioMaxM", () => {
        expect(validarFilas(con(3, { radioMinM: 31 })).join()).toMatch(/Fila 4: radioMinM no puede ser mayor/);
    });

    it("exige radios en [0, 500]", () => {
        expect(validarFilas(con(0, { radioMinM: -1 })).join()).toMatch(/radioMinM debe estar en \[0, 500\]/);
        expect(validarFilas(con(3, { radioMaxM: 501 })).join()).toMatch(/radioMaxM debe estar en \[0, 500\]/);
        expect(validarFilas(con(3, { radioMaxM: 500 }))).toEqual([]);
    });

    it("exige radios no decrecientes entre filas", () => {
        expect(validarFilas(con(2, { radioMinM: 2 })).join()).toMatch(/Fila 3: radioMinM no puede ser menor/);
        expect(validarFilas(con(2, { radioMaxM: 7, radioMinM: 7 })).join()).toMatch(
            /Fila 3: radioMaxM no puede ser menor/,
        );
    });

    it("rechaza una entrada que no es arreglo sin lanzar (null llegaría como 500)", () => {
        expect(validarFilas(null as unknown as FilaRegla[])).toEqual(["La tabla debe ser una lista de filas."]);
        expect(validarFilas({} as unknown as FilaRegla[])).toEqual(["La tabla debe ser una lista de filas."]);
    });
});
