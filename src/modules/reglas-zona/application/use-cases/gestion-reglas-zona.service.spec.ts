import { GestionReglasZonaService } from "./gestion-reglas-zona.service";
import { ReglaZona, type EstadoRegla } from "../../domain/entities/regla-zona";
import { FILAS_EJEMPLO } from "../../domain/testing/filas-ejemplo";
import type { IReglasZonaRepository } from "../../domain/ports/out/reglas-zona.repository";
import {
    ReglaInmutableError,
    ReglaNoAprobadaError,
    ReglaNoEncontradaError,
    SinPermisoAprobarError,
} from "../../domain/errors/reglas-zona.error";

const id = "11111111-1111-4111-8111-111111111111";
const agronomo = { id: "agro-1", rol: "agronomo" },
    admin = { id: "admin-1", rol: "admin" };
const regla = (estado: EstadoRegla = "borrador") =>
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
    });

describe("Casos de uso de reglas de zona", () => {
    const repo = {
        obtener: jest.fn(),
        listar: jest.fn(),
        obtenerActiva: jest.fn(),
        insertarNuevaVersion: jest.fn(),
        guardarBorrador: jest.fn(),
        eliminarBorrador: jest.fn(),
        guardarAprobacion: jest.fn(),
        activar: jest.fn(),
        archivar: jest.fn(),
    };
    const auditoria = { registrar: jest.fn() },
        aprobadores = { agronomoValidado: jest.fn() };
    let servicio: GestionReglasZonaService;

    beforeEach(() => {
        jest.resetAllMocks();
        repo.obtener.mockResolvedValue(regla());
        repo.guardarBorrador.mockResolvedValue(true);
        repo.eliminarBorrador.mockResolvedValue(true);
        repo.guardarAprobacion.mockResolvedValue(true);
        repo.insertarNuevaVersion.mockImplementation((_tipo: string, construir: (v: number) => ReglaZona) =>
            Promise.resolve(construir(7)),
        );
        const repositorio: IReglasZonaRepository = repo;
        aprobadores.agronomoValidado.mockResolvedValue({ nombre: "Ana Pérez", tarjetaProfesional: "TP-123" });
        servicio = new GestionReglasZonaService(repositorio, auditoria, aprobadores);
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
        repo.obtener.mockResolvedValue(null);
        await expect(servicio.obtener(id)).rejects.toBeInstanceOf(ReglaNoEncontradaError);
    });

    it.each<EstadoRegla>(["aprobada", "activa", "archivada"])(
        "no edita ni borra una regla %s (REGLA_INMUTABLE) y no audita",
        async (estado) => {
            repo.obtener.mockResolvedValue(regla(estado));
            await expect(servicio.editar(admin, id, { notas: "x" })).rejects.toBeInstanceOf(ReglaInmutableError);
            await expect(servicio.eliminar(admin, id)).rejects.toBeInstanceOf(ReglaInmutableError);
            expect(repo.guardarBorrador).not.toHaveBeenCalled();
            expect(repo.eliminarBorrador).not.toHaveBeenCalled();
            expect(auditoria.registrar).not.toHaveBeenCalled();
        },
    );

    it("si otra operación aprobó el borrador entre la lectura y el guardado, responde REGLA_INMUTABLE", async () => {
        repo.guardarBorrador.mockResolvedValue(false);
        await expect(servicio.editar(admin, id, { notas: "x" })).rejects.toBeInstanceOf(ReglaInmutableError);
    });

    it("aprobar sin rol agrónomo → SIN_PERMISO_APROBAR, sin tocar la regla", async () => {
        await expect(servicio.aprobar(admin, id, { calibrada: false })).rejects.toBeInstanceOf(SinPermisoAprobarError);
        expect(repo.guardarAprobacion).not.toHaveBeenCalled();
        expect(auditoria.registrar).not.toHaveBeenCalled();
    });

    it("aprobar con rol agrónomo pero cuenta no validada → SIN_PERMISO_APROBAR", async () => {
        aprobadores.agronomoValidado.mockResolvedValue(null);
        await expect(servicio.aprobar(agronomo, id, { calibrada: false })).rejects.toMatchObject({
            codigo: "SIN_PERMISO_APROBAR",
        });
        expect(aprobadores.agronomoValidado).toHaveBeenCalledWith("agro-1");
        expect(repo.guardarAprobacion).not.toHaveBeenCalled();
    });

    it("aprobar como agrónomo validado guarda nombre y tarjeta, y la auditoría no los incluye", async () => {
        const vista = await servicio.aprobar(agronomo, id, { calibrada: true, nota: "Validada en campo" });
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
