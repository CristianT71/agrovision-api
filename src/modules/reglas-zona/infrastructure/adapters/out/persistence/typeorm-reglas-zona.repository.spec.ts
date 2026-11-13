import type { DataSource, EntityManager } from "typeorm";
import { TypeOrmReglasZonaRepository } from "./typeorm-reglas-zona.repository";
import { ReglaZona } from "../../../../domain/entities/regla-zona";
import { FILAS_EJEMPLO } from "../../../../domain/testing/filas-ejemplo";
import { ReglaNoAprobadaError, VersionEnConflictoError } from "../../../../domain/errors/reglas-zona.error";

jest.mock("typeorm", () => ({ DataSource: class {} }));

const nueva = "22222222-2222-4222-8222-222222222222",
    previa = "33333333-3333-4333-8333-333333333333";
const aprobada = () => {
    const r = ReglaZona.crearBorrador({
        id: nueva,
        tipoEnfermedad: "roya",
        version: 2,
        notas: null,
        filas: FILAS_EJEMPLO,
        creadaPor: "u",
        ahora: new Date(),
    });
    r.aprobar({ nombre: "Ana", tarjetaProfesional: "TP" }, "agro", { calibrada: false }, new Date());
    return r;
};

describe("Persistencia de reglas de zona", () => {
    const query = jest.fn();
    const tx = { query } as unknown as EntityManager;
    const db = {
        query,
        manager: tx,
        transaction: jest.fn((fn: (m: EntityManager) => Promise<unknown>) => fn(tx)),
    };
    const repo = new TypeOrmReglasZonaRepository(db as unknown as DataSource);

    beforeEach(() => {
        query.mockReset();
        db.transaction.mockClear();
    });

    it("activar archiva la activa previa del mismo tipo y activa la nueva en una transacción", async () => {
        query
            .mockResolvedValueOnce([
                { id: nueva, estado: "aprobada" },
                { id: previa, estado: "activa" },
            ])
            .mockResolvedValueOnce([{ id: previa }])
            .mockResolvedValueOnce([]);
        const regla = aprobada();
        regla.activar(new Date("2026-11-13T00:00:00Z"));

        expect(await repo.activar(regla)).toEqual({ archivadaId: previa });
        expect(db.transaction).toHaveBeenCalledTimes(1);
        const sql = query.mock.calls.map((c: [string, unknown[]]) => c[0]);
        expect(sql[0]).toMatch(/FOR UPDATE/);
        expect(sql[1]).toMatch(/SET estado='archivada'.*WHERE tipo_enfermedad=\$1 AND estado='activa'/s);
        expect(query.mock.calls[1][1]).toEqual(["roya", regla.instantanea().activadaEn]);
        expect(sql[2]).toMatch(/SET estado='activa'/);
        expect(query.mock.calls[2][1]).toEqual([nueva, regla.instantanea().activadaEn]);
        // Primero archiva la previa: el índice único parcial nunca ve dos activas.
        expect(sql.findIndex((s) => /estado='archivada'/.test(s))).toBeLessThan(
            sql.findIndex((s) => /SET estado='activa'/.test(s)),
        );
    });

    it("sin activa previa devuelve archivadaId null", async () => {
        query
            .mockResolvedValueOnce([{ id: nueva, estado: "aprobada" }])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([]);
        const regla = aprobada();
        regla.activar(new Date());
        expect(await repo.activar(regla)).toEqual({ archivadaId: null });
    });

    it("si otra operación cambió la regla antes del bloqueo, no archiva nada (REGLA_NO_APROBADA)", async () => {
        query.mockResolvedValueOnce([{ id: nueva, estado: "activa" }]);
        const regla = aprobada();
        regla.activar(new Date());
        await expect(repo.activar(regla)).rejects.toBeInstanceOf(ReglaNoAprobadaError);
        expect(query).toHaveBeenCalledTimes(1);
    });

    it("las escrituras de borrador y aprobación están condicionadas a estado='borrador'", async () => {
        query.mockResolvedValue([]);
        const regla = aprobada();
        expect(await repo.guardarAprobacion(regla)).toBe(false);
        expect(query.mock.calls[0][0]).toMatch(/WHERE id=\$1 AND estado='borrador'/);
        expect(await repo.eliminarBorrador(nueva)).toBe(false);
        expect(query.mock.calls[1][0]).toMatch(/DELETE FROM reglas_zona WHERE id=\$1 AND estado='borrador'/);
    });

    it("traduce la violación de UNIQUE(tipo, versión) a VERSION_EN_CONFLICTO", async () => {
        query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ siguiente: 1 }]);
        query.mockRejectedValueOnce(Object.assign(new Error("duplicate key"), { code: "23505" }));
        await expect(
            repo.insertarNuevaVersion("roya", (version) =>
                ReglaZona.crearBorrador({
                    id: nueva,
                    tipoEnfermedad: "roya",
                    version,
                    notas: null,
                    filas: FILAS_EJEMPLO,
                    creadaPor: "u",
                    ahora: new Date(),
                }),
            ),
        ).rejects.toBeInstanceOf(VersionEnConflictoError);
    });

    it("lee reglas con sus filas ordenadas y convierte a dominio", async () => {
        query
            .mockResolvedValueOnce([
                {
                    id: nueva,
                    tipo_enfermedad: "roya",
                    version: 2,
                    estado: "activa",
                    calibrada: true,
                    notas: null,
                    creada_por: null,
                    creada_en: new Date(),
                    aprobada_por_usuario_id: "agro",
                    aprobada_por_nombre: "Ana",
                    aprobada_por_tarjeta: "TP",
                    aprobada_en: new Date(),
                    activada_en: new Date(),
                },
            ])
            .mockResolvedValueOnce(
                [...FILAS_EJEMPLO].reverse().map((f) => ({
                    regla_id: nueva,
                    orden: f.orden,
                    sev_max: f.sevMax,
                    inc_max: f.incMax,
                    radio_min_m: f.radioMinM,
                    radio_max_m: f.radioMaxM,
                })),
            );
        const r = await repo.obtenerActiva("roya");
        expect(r?.filas).toEqual(FILAS_EJEMPLO);
        expect(r?.vista().aprobadaPor).toEqual({ nombre: "Ana", tarjetaProfesional: "TP" });
    });
});
