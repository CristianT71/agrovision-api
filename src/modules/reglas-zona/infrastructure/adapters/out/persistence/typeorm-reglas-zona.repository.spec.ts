import { TypeOrmReglasZonaRepository } from "./typeorm-reglas-zona.repository";
import { ReglaZona } from "../../../../domain/entities/regla-zona";
import { FILAS_EJEMPLO } from "../../../../domain/testing/filas-ejemplo";
import { ReglaNoAprobadaError, VersionEnConflictoError } from "../../../../domain/errors/reglas-zona.error";

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
    // El repositorio escribe con el gestor que recibe: la transacción la abre la unidad de trabajo.
    const repo = new TypeOrmReglasZonaRepository({ query });

    beforeEach(() => {
        query.mockReset();
    });

    it("activar archiva la activa previa del mismo tipo y activa la nueva, en ese orden", async () => {
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

    it("guardar y aprobar se condicionan a estado='borrador' y a la revisión vista", async () => {
        query.mockResolvedValue([]);
        const regla = aprobada();
        expect(await repo.guardarAprobacion(regla, 1)).toBe(false);
        expect(query.mock.calls[0][0]).toMatch(/WHERE id=\$1 AND estado='borrador' AND revision=\$9/);
        expect(query.mock.calls[0][1].slice(-2)).toEqual([2, 1]);
        expect(await repo.guardarBorrador(regla, 5, true)).toBe(false);
        expect(query.mock.calls[1][0]).toMatch(
            /SET notas=\$2, revision=\$3\s+WHERE id=\$1 AND estado='borrador' AND revision=\$4/,
        );
        expect(query.mock.calls[1][1][3]).toBe(5);
        // Sin coincidencia no se tocan las filas.
        expect(query).toHaveBeenCalledTimes(2);
        expect(await repo.eliminarBorrador(nueva)).toBe(false);
        expect(query.mock.calls[2][0]).toMatch(/DELETE FROM reglas_zona WHERE id=\$1 AND estado='borrador'/);
    });

    it("un guardado de solo notas no borra ni reinserta filas; con filas, sí", async () => {
        query.mockResolvedValue([{ id: nueva }]);
        const regla = aprobada();
        expect(await repo.guardarBorrador(regla, 1, false)).toBe(true);
        expect(query).toHaveBeenCalledTimes(1);
        query.mockClear();
        expect(await repo.guardarBorrador(regla, 1, true)).toBe(true);
        const sql = query.mock.calls.map((c: [string, unknown[]]) => c[0]);
        expect(sql[1]).toMatch(/DELETE FROM reglas_zona_filas/);
        expect(sql[2]).toMatch(/INSERT INTO reglas_zona_filas/);
    });

    it("obtenerParaModificar bloquea la cabecera y lee después, en sentencias separadas", async () => {
        query.mockResolvedValueOnce([]);
        expect(await repo.obtenerParaModificar(nueva)).toBeNull();
        expect(query).toHaveBeenCalledTimes(1);
        expect(query.mock.calls[0][0]).toMatch(/FOR UPDATE/);
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

    const cabecera = (id: string, version: number, filas: typeof FILAS_EJEMPLO) => ({
        id,
        tipo_enfermedad: "roya",
        version,
        revision: 3,
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
        filas: filas.map((f) => ({
            orden: f.orden,
            sev_max: f.sevMax,
            inc_max: f.incMax,
            radio_min_m: f.radioMinM,
            radio_max_m: f.radioMaxM,
        })),
    });

    it("lee cabecera y filas en una sola sentencia y convierte a dominio", async () => {
        query.mockResolvedValueOnce([cabecera(nueva, 2, [...FILAS_EJEMPLO].reverse())]);
        const r = await repo.obtenerActiva("roya");
        expect(r?.filas).toEqual(FILAS_EJEMPLO);
        expect(r?.revision).toBe(3);
        expect(r?.vista().aprobadaPor).toEqual({ nombre: "Ana", tarjetaProfesional: "TP" });
        expect(query).toHaveBeenCalledTimes(1);
        expect(query.mock.calls[0][0]).toMatch(/json_agg/);
    });

    it("listar entrega a cada regla sus propias filas", async () => {
        const unaFila = { orden: 1, sevMax: 100, incMax: 100, radioMinM: 0, radioMaxM: 5 };
        query.mockResolvedValueOnce([cabecera(nueva, 2, FILAS_EJEMPLO), cabecera(previa, 1, [unaFila])]);
        const reglas = await repo.listar({ tipo: "roya" });
        expect(reglas.map((r) => r.id)).toEqual([nueva, previa]);
        expect(reglas[0].filas).toEqual(FILAS_EJEMPLO);
        expect(reglas[1].filas).toEqual([unaFila]);
        expect(query).toHaveBeenCalledTimes(1);
    });
});
