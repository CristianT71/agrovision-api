import { GestionReglasZonaService } from "./gestion-reglas-zona.service";
import { ReglaZona, type EstadoRegla } from "../../domain/entities/regla-zona";
import { FILAS_EJEMPLO } from "../../domain/testing/filas-ejemplo";
import type { IReglasZonaEscritura, IReglasZonaRepository } from "../../domain/ports/out/reglas-zona.repository";
import type { TransaccionReglasZona } from "../../domain/ports/out/unidad-trabajo.port";
import {
    ReglaInmutableError,
    ReglaNoAprobadaError,
    ReglaNoEncontradaError,
    RevisionEnConflictoError,
    SinPermisoAprobarError,
} from "../../domain/errors/reglas-zona.error";

const id = "11111111-1111-4111-8111-111111111111";
const agronomo = { id: "agro-1", rol: "agronomo" },
    admin = { id: "admin-1", rol: "admin" };
const regla = (estado: EstadoRegla = "borrador", revision = 1) =>
    ReglaZona.reconstruir({
        ...ReglaZona.crearBorrador({
            id,
            tipoEnfermedad: "roya",
            version: 3,
            notas: null,
            filas: FILAS_EJEMPLO,
            creadaPor: "u",
            ahora: new Date(),
        }).instantanea(),
        estado,
        revision,
    });

describe("Casos de uso de reglas de zona", () => {
    // Lecturas (fuera de transacción) y escrituras (dentro de la unidad de trabajo) son puertos distintos.
    const lectura = { obtener: jest.fn(), listar: jest.fn(), obtenerActiva: jest.fn() };
    const repo = {
        obtener: jest.fn(),
        obtenerParaModificar: jest.fn(),
        insertarNuevaVersion: jest.fn(),
        guardarBorrador: jest.fn(),
        eliminarBorrador: jest.fn(),
        guardarAprobacion: jest.fn(),
        activar: jest.fn(),
        archivar: jest.fn(),
    };
    const auditoria = { registrar: jest.fn() },
        aprobadores = { agronomoValidado: jest.fn() };
    // Unidad de trabajo falsa: registra si la transacción se confirmó o se revirtió.
    const unidad = {
        confirmadas: 0,
        revertidas: 0,
        async ejecutar<T>(trabajo: (tx: TransaccionReglasZona) => Promise<T>): Promise<T> {
            const reglas: IReglasZonaEscritura = repo;
            try {
                const resultado = await trabajo({ reglas, auditoria });
                this.confirmadas++;
                return resultado;
            } catch (error) {
                this.revertidas++;
                throw error;
            }
        },
    };
    let servicio: GestionReglasZonaService;

    beforeEach(() => {
        jest.resetAllMocks();
        unidad.confirmadas = unidad.revertidas = 0;
        lectura.obtener.mockResolvedValue(regla());
        repo.obtener.mockResolvedValue(regla());
        repo.obtenerParaModificar.mockResolvedValue(regla());
        repo.guardarBorrador.mockResolvedValue(true);
        repo.eliminarBorrador.mockResolvedValue(true);
        repo.guardarAprobacion.mockResolvedValue(true);
        repo.insertarNuevaVersion.mockImplementation((_tipo: string, construir: (v: number) => ReglaZona) =>
            Promise.resolve(construir(7)),
        );
        const repositorio: IReglasZonaRepository = lectura;
        aprobadores.agronomoValidado.mockResolvedValue({ nombre: "Ana Pérez", tarjetaProfesional: "TP-123" });
        servicio = new GestionReglasZonaService(repositorio, unidad, aprobadores);
    });

    it("crea un borrador con la versión que asigna el repositorio y lo audita", async () => {
        const vista = await servicio.crear(admin, { tipoEnfermedad: "roya", notas: null, filas: FILAS_EJEMPLO });
        expect(vista).toMatchObject({ tipoEnfermedad: "roya", version: 7, estado: "borrador", creadaPor: "admin-1" });
        expect(auditoria.registrar).toHaveBeenCalledWith(
            expect.objectContaining({ accion: "crear", actorUsuarioId: "admin-1", reglaId: vista.id }),
        );
    });

    it("una tabla inválida no reserva versión", async () => {
        await expect(
            servicio.crear(admin, { tipoEnfermedad: "roya", notas: null, filas: FILAS_EJEMPLO.slice(0, 1) }),
        ).rejects.toMatchObject({ codigo: "REGLA_INVALIDA" });
        expect(repo.insertarNuevaVersion).not.toHaveBeenCalled();
    });

    it("404 de dominio si la regla no existe", async () => {
        lectura.obtener.mockResolvedValue(null);
        await expect(servicio.obtener(id)).rejects.toBeInstanceOf(ReglaNoEncontradaError);
    });

    it.each<EstadoRegla>(["aprobada", "activa", "archivada"])(
        "no edita ni borra una regla %s (REGLA_INMUTABLE) y no audita",
        async (estado) => {
            repo.obtenerParaModificar.mockResolvedValue(regla(estado));
            await expect(servicio.editar(admin, id, { revision: 1, notas: "x" })).rejects.toBeInstanceOf(
                ReglaInmutableError,
            );
            await expect(servicio.eliminar(admin, id)).rejects.toBeInstanceOf(ReglaInmutableError);
            expect(repo.guardarBorrador).not.toHaveBeenCalled();
            expect(repo.eliminarBorrador).not.toHaveBeenCalled();
            expect(auditoria.registrar).not.toHaveBeenCalled();
        },
    );

    it("editar con la revisión vigente la incrementa y guarda condicionado a la revisión vista", async () => {
        repo.obtenerParaModificar.mockResolvedValue(regla("borrador", 4));
        const vista = await servicio.editar(admin, id, { revision: 4, notas: "x" });
        expect(vista).toMatchObject({ revision: 5, notas: "x" });
        expect(repo.guardarBorrador).toHaveBeenCalledWith(expect.any(ReglaZona), 4, false);
        expect(unidad.confirmadas).toBe(1);
    });

    it("un PATCH de solo notas no reescribe las filas; uno con filas sí", async () => {
        await servicio.editar(admin, id, { revision: 1, notas: "solo notas" });
        expect(repo.guardarBorrador.mock.calls[0][2]).toBe(false);
        repo.obtenerParaModificar.mockResolvedValue(regla());
        await servicio.editar(admin, id, { revision: 1, filas: FILAS_EJEMPLO });
        expect(repo.guardarBorrador.mock.calls[1][2]).toBe(true);
    });

    it("editar o aprobar con una revisión antigua → VERSION_EN_CONFLICTO, sin guardar ni auditar", async () => {
        repo.obtenerParaModificar.mockResolvedValue(regla("borrador", 3));
        await expect(servicio.editar(admin, id, { revision: 2, notas: "x" })).rejects.toMatchObject({
            codigo: "VERSION_EN_CONFLICTO",
        });
        await expect(servicio.aprobar(agronomo, id, { revision: 2, calibrada: false })).rejects.toBeInstanceOf(
            RevisionEnConflictoError,
        );
        expect(repo.guardarBorrador).not.toHaveBeenCalled();
        expect(repo.guardarAprobacion).not.toHaveBeenCalled();
        expect(auditoria.registrar).not.toHaveBeenCalled();
        expect(unidad.revertidas).toBe(2);
    });

    it("si el UPDATE condicionado no toca ninguna fila, responde VERSION_EN_CONFLICTO", async () => {
        repo.guardarBorrador.mockResolvedValue(false);
        repo.guardarAprobacion.mockResolvedValue(false);
        await expect(servicio.editar(admin, id, { revision: 1, notas: "x" })).rejects.toBeInstanceOf(
            RevisionEnConflictoError,
        );
        await expect(servicio.aprobar(agronomo, id, { revision: 1, calibrada: false })).rejects.toBeInstanceOf(
            RevisionEnConflictoError,
        );
        expect(auditoria.registrar).not.toHaveBeenCalled();
    });

    it("aprobar guarda la revisión que el agrónomo revisó y devuelve la regla leída bajo bloqueo", async () => {
        repo.obtenerParaModificar.mockResolvedValue(regla("borrador", 6));
        const vista = await servicio.aprobar(agronomo, id, { revision: 6, calibrada: false });
        expect(vista).toMatchObject({ estado: "aprobada", revision: 7 });
        expect(repo.guardarAprobacion).toHaveBeenCalledWith(expect.any(ReglaZona), 6);
    });

    it.each([
        ["crear", () => servicio.crear(admin, { tipoEnfermedad: "roya", notas: null, filas: FILAS_EJEMPLO })],
        ["editar", () => servicio.editar(admin, id, { revision: 1, notas: "x" })],
        ["borrar", () => servicio.eliminar(admin, id)],
        ["duplicar", () => servicio.duplicar(admin, id)],
        ["aprobar", () => servicio.aprobar(agronomo, id, { revision: 1, calibrada: false })],
        [
            "activar",
            () => {
                repo.obtener.mockResolvedValue(regla("aprobada"));
                repo.activar.mockResolvedValue({ archivadaId: null });
                return servicio.activar(admin, id);
            },
        ],
        [
            "archivar",
            () => {
                repo.obtener.mockResolvedValue(regla("activa"));
                repo.archivar.mockResolvedValue(true);
                return servicio.archivar(admin, id);
            },
        ],
    ])("%s: si la auditoría falla, la operación entera se revierte", async (accion, operar) => {
        auditoria.registrar.mockRejectedValue(new Error("auditoría caída"));
        await expect(operar()).rejects.toThrow("auditoría caída");
        // La auditoría se intentó dentro de la misma unidad de trabajo que el cambio, y esta no se confirmó.
        expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion }));
        expect(unidad.confirmadas).toBe(0);
        expect(unidad.revertidas).toBe(1);
    });

    it("aprobar sin rol agrónomo → SIN_PERMISO_APROBAR, sin tocar la regla", async () => {
        await expect(servicio.aprobar(admin, id, { revision: 1, calibrada: false })).rejects.toBeInstanceOf(
            SinPermisoAprobarError,
        );
        expect(repo.guardarAprobacion).not.toHaveBeenCalled();
        expect(auditoria.registrar).not.toHaveBeenCalled();
    });

    it("aprobar con rol agrónomo pero cuenta no validada → SIN_PERMISO_APROBAR", async () => {
        aprobadores.agronomoValidado.mockResolvedValue(null);
        await expect(servicio.aprobar(agronomo, id, { revision: 1, calibrada: false })).rejects.toMatchObject({
            codigo: "SIN_PERMISO_APROBAR",
        });
        expect(aprobadores.agronomoValidado).toHaveBeenCalledWith("agro-1");
        expect(repo.guardarAprobacion).not.toHaveBeenCalled();
    });

    it("aprobar como agrónomo validado guarda nombre y tarjeta, y la auditoría no los incluye", async () => {
        const vista = await servicio.aprobar(agronomo, id, { revision: 1, calibrada: true, nota: "Validada en campo" });
        expect(vista).toMatchObject({
            estado: "aprobada",
            calibrada: true,
            aprobadaPor: { nombre: "Ana Pérez", tarjetaProfesional: "TP-123" },
        });
        const registro = JSON.stringify(auditoria.registrar.mock.calls[0][0]);
        expect(registro).toContain('"accion":"aprobar"');
        expect(registro).not.toContain("Ana Pérez");
        expect(registro).not.toContain("TP-123");
        expect(registro).not.toContain("Validada en campo");
    });

    it("activar exige una regla aprobada y audita la regla archivada", async () => {
        await expect(servicio.activar(admin, id)).rejects.toBeInstanceOf(ReglaNoAprobadaError);
        expect(repo.activar).not.toHaveBeenCalled();

        repo.obtener.mockResolvedValue(regla("aprobada"));
        repo.activar.mockResolvedValue({ archivadaId: "previa" });
        const vista = await servicio.activar(admin, id);
        expect(vista.estado).toBe("activa");
        expect(auditoria.registrar.mock.calls[0][0]).toMatchObject({
            accion: "activar",
            detalle: { archivadaId: "previa" },
        });
    });

    it("duplicar crea la siguiente versión en borrador y audita el origen", async () => {
        repo.obtener.mockResolvedValue(regla("activa"));
        const vista = await servicio.duplicar(agronomo, id);
        expect(vista).toMatchObject({ estado: "borrador", version: 7, calibrada: false });
        expect(vista.id).not.toBe(id);
        expect(auditoria.registrar.mock.calls[0][0]).toMatchObject({ accion: "duplicar", detalle: { origenId: id } });
    });

    it("simular: sev 70, inc 55, 5000 pl/ha → fila 4, 15–30 m, 353–1414 plantas", async () => {
        expect(await servicio.simular(id, { severidadPct: 70, incidenciaPct: 55, plantasPorHa: 5000 })).toEqual({
            reglaVersion: 3,
            filaAplicada: 4,
            radioMinM: 15,
            radioMaxM: 30,
            plantasMin: 353,
            plantasMax: 1414,
            calibrada: false,
        });
    });
});
