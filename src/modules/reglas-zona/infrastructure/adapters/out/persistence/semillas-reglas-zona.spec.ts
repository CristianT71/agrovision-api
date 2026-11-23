import { validarFilas } from "../../../../domain/services/validar-filas";
import { FILAS_SEMILLA_REGLAS_ZONA, SEMILLAS_REGLAS_ZONA, sembrarReglasZona } from "./semillas-reglas-zona";

describe("sembrarReglasZona", () => {
    it("siembra los 6 tipos (4 enfermedades y 2 plagas) con ids fijos y una tabla válida", () => {
        expect(SEMILLAS_REGLAS_ZONA.map((s) => s.tipoEnfermedad)).toEqual([
            "roya",
            "cercospora",
            "phoma",
            "antracnosis",
            "minador",
            "hormigas",
        ]);
        expect(new Set(SEMILLAS_REGLAS_ZONA.map((s) => s.id)).size).toBe(6);
        expect(validarFilas([...FILAS_SEMILLA_REGLAS_ZONA])).toEqual([]);
    });

    it("es idempotente y no toca reglas existentes: solo tipos sin reglas, y filas solo para la regla recién creada", async () => {
        const consultar = jest.fn().mockResolvedValue([]);
        await sembrarReglasZona(consultar);
        expect(consultar).toHaveBeenCalledTimes(6);
        const [sql, parametros] = consultar.mock.calls[0] as [string, unknown[]];
        expect(sql).toMatch(/WHERE NOT EXISTS \(SELECT 1 FROM "reglas_zona" WHERE "tipo_enfermedad" = \$2::varchar\)/);
        expect(sql).toMatch(/ON CONFLICT DO NOTHING\s+RETURNING "id"/);
        // Las filas salen del CTE: si la regla no se insertó, no se añade ninguna fila a una regla existente.
        expect(sql).toMatch(/FROM nueva CROSS JOIN \(VALUES/);
        expect(sql).not.toMatch(/UPDATE|DELETE/);
        expect(parametros.slice(0, 2)).toEqual([SEMILLAS_REGLAS_ZONA[0].id, "roya"]);
        expect(parametros[2]).toMatch(/VALORES DE EJEMPLO/);
        expect(parametros).toHaveLength(3 + FILAS_SEMILLA_REGLAS_ZONA.length * 5);
        expect(
            sql
                .match(/\$\d+/g)
                ?.map((p) => Number(p.slice(1)))
                .reduce((a, b) => Math.max(a, b)),
        ).toBe(parametros.length);
    });
});
