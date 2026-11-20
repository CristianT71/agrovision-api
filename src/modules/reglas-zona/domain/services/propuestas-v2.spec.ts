import {
    MARCA_PROPUESTA_V2,
    PROPUESTAS_REGLAS_ZONA_V2,
    sembrarPropuestasV2,
} from "../../infrastructure/adapters/out/persistence/semillas-reglas-zona-v2";
import { validarFilas } from "./validar-filas";

describe("Propuestas v2 de reglas de zona", () => {
    it.each(PROPUESTAS_REGLAS_ZONA_V2.map((p) => [p.tipoEnfermedad, p] as const))(
        "%s cumple el contrato de la tabla y declara que los radios no tienen fuente",
        (_tipo, p) => {
            expect(validarFilas(p.filas)).toEqual([]);
            expect(p.notas).toContain(MARCA_PROPUESTA_V2);
            expect(p.notas).toMatch(/radios en metros NO tienen fuente/);
            expect(p.notas).toMatch(/https:\/\//);
        },
    );

    it("los cortes de incidencia de la roya son 5 y 15 %", () => {
        const roya = PROPUESTAS_REGLAS_ZONA_V2.find((p) => p.tipoEnfermedad === "roya");
        expect(roya?.filas.map((f) => f.incMax)).toEqual([5, 15, 100]);
    });

    it("solo propone roya y cercospora: los demás tipos no tienen un corte citable", () => {
        expect(PROPUESTAS_REGLAS_ZONA_V2.map((p) => p.tipoEnfermedad)).toEqual(["roya", "cercospora"]);
    });

    it("siembra de forma idempotente y sin tocar reglas existentes", async () => {
        const consultar = jest.fn().mockResolvedValue([]);
        await sembrarPropuestasV2(consultar);
        expect(consultar).toHaveBeenCalledTimes(2);
        const [sql] = consultar.mock.calls[0] as [string];
        expect(sql).toMatch(/ON CONFLICT DO NOTHING/);
        expect(sql).toMatch(/HAVING COUNT\(\*\) > 0 AND NOT EXISTS/);
        expect(sql).not.toMatch(/UPDATE|DELETE/);
    });
});
