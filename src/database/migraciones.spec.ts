import { readdirSync } from "node:fs";
import { join } from "node:path";
import type { QueryRunner } from "typeorm";
import { CrearReglasZona1793600000000 } from "./migrations/1793600000000-CrearReglasZona";
import { SembrarReglasZonaPendientes1793700000000 } from "./migrations/1793700000000-SembrarReglasZonaPendientes";

const DIRECTORIO = join(__dirname, "migrations");

describe("Migraciones", () => {
    // TypeORM instancia como migración CADA función exportada por los archivos del glob: una función auxiliar
    // exportada rompe migration:run con "migrationClass is not a constructor".
    it.each(readdirSync(DIRECTORIO).filter((a) => a.endsWith(".ts") && !a.endsWith(".spec.ts")))(
        "%s solo exporta clases de migración",
        (archivo) => {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const modulo = require(join(DIRECTORIO, archivo)) as Record<string, unknown>;
            const funciones = Object.values(modulo).filter((v) => typeof v === "function");
            expect(funciones.length).toBeGreaterThan(0);
            for (const exportada of funciones as (new () => { up?: unknown; down?: unknown })[]) {
                const instancia = new exportada();
                expect(typeof instancia.up).toBe("function");
                expect(typeof instancia.down).toBe("function");
            }
        },
    );

    describe("CrearReglasZona.down", () => {
        const runner = (total: number) => {
            const query = jest.fn((sql: string) => Promise.resolve(/COUNT/.test(sql) ? [{ total }] : []));
            return { query, qr: { query } as unknown as QueryRunner };
        };

        it("se niega a borrar la auditoría si tiene historial", async () => {
            const { query, qr } = runner(3);
            await expect(new CrearReglasZona1793600000000().down(qr)).rejects.toThrow(/auditoria_reglas_zona tiene 3/);
            expect(query.mock.calls.some(([sql]) => /DROP/.test(sql))).toBe(false);
        });

        it("sin historial elimina las tablas", async () => {
            const { query, qr } = runner(0);
            await new CrearReglasZona1793600000000().down(qr);
            expect(query.mock.calls.filter(([sql]) => /DROP TABLE/.test(sql))).toHaveLength(3);
        });
    });

    it("SembrarReglasZonaPendientes siembra con la función compartida y su down no borra nada", async () => {
        const query = jest.fn().mockResolvedValue([]);
        await new SembrarReglasZonaPendientes1793700000000().up({ query } as unknown as QueryRunner);
        expect(query).toHaveBeenCalledTimes(6);
        expect((query.mock.calls as [string][])[0][0]).toMatch(/ON CONFLICT DO NOTHING/);
        await new SembrarReglasZonaPendientes1793700000000().down();
        expect(query).toHaveBeenCalledTimes(6);
    });
});
