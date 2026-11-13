import { GestionVuelosService, vistaArchivo } from "./gestion-vuelos.service";
import { normalizarTags } from "../../domain/services/normalizar-tags";
import type { ArchivoVuelo, ArchivoRecibido } from "../../domain/entities/vuelo";
import type { IVuelosRepository } from "../../domain/ports/out/vuelos.repository";
import type { IAlmacenamientoVuelos } from "../../domain/ports/out/almacenamiento-vuelos.port";
import { ArchivoVueloNoEncontradoError } from "../../domain/errors/vuelos.error";
const id = "11111111-1111-4111-8111-111111111111",
    archivoId = "22222222-2222-4222-8222-222222222222";
const recibido: ArchivoRecibido = {
    id: archivoId,
    nombreOriginal: "a.jpg",
    extension: ".jpg",
    mime: "image/jpeg",
    tamanoBytes: 2,
    sha256: "abc",
    rutaAlmacenamiento: `${id}/${archivoId}.jpg`,
};
const archivo: ArchivoVuelo = {
    ...recibido,
    ...normalizarTags({ RtkFlag: 50 }, "a.jpg"),
    vueloId: id,
    creadoEn: new Date(),
};
describe("Casos de uso de vuelos", () => {
    let servicio: GestionVuelosService;
    const repo = {
        obtener: jest.fn(),
        guardarArchivo: jest.fn(),
        archivo: jest.fn(),
        eliminarAuditado: jest.fn(),
        resumen: jest.fn(),
        listar: jest.fn(),
        listarArchivos: jest.fn(),
        crearAuditado: jest.fn(),
    };
    const disco = {
        rutaLocal: jest.fn((r: string) => r),
        miniatura: jest.fn(),
        eliminarArchivo: jest.fn(),
        eliminarVuelo: jest.fn(),
    };
    const extractor = { extraer: jest.fn() },
        firmador = { firmar: jest.fn((_id: string, _variante: string, _exp: number) => "token"), verificar: jest.fn() },
        auditoria = { registrar: jest.fn() };
    beforeEach(() => {
        jest.resetAllMocks();
        repo.obtener.mockResolvedValue({
            id,
            nombre: "vuelo",
            lote: null,
            notas: null,
            creadoEn: new Date(),
            creadoPor: "actor",
        });
        disco.rutaLocal.mockImplementation((r) => r);
        disco.miniatura.mockResolvedValue(false);
        extractor.extraer.mockResolvedValue(normalizarTags({}, "a.jpg"));
        servicio = new GestionVuelosService(
            repo as unknown as IVuelosRepository,
            disco as unknown as IAlmacenamientoVuelos,
            extractor,
            firmador,
            auditoria,
        );
    });
    it("resuelve duplicados con el existente y elimina el recién escrito", async () => {
        repo.guardarArchivo.mockResolvedValue({ archivo: { ...archivo, id: "existente" }, duplicado: true });
        const r = await servicio.subir(id, recibido);
        expect(r.duplicado).toBe(true);
        expect(r.archivo.id).toBe("existente");
        expect(disco.eliminarArchivo).toHaveBeenCalledWith(recibido.rutaAlmacenamiento);
    });
    it("limpia si falla la persistencia y conserva la causa", async () => {
        repo.guardarArchivo.mockRejectedValue(new Error("base"));
        await expect(servicio.subir(id, recibido)).rejects.toThrow("base");
        expect(disco.eliminarArchivo).toHaveBeenCalledTimes(1);
    });
    it("verifica pertenencia antes de consultar o firmar un archivo ajeno", async () => {
        repo.archivo.mockResolvedValue(null);
        await expect(servicio.obtenerArchivo(id, archivoId)).rejects.toBeInstanceOf(ArchivoVueloNoEncontradoError);
        await expect(servicio.enlace(id, archivoId, "actor")).rejects.toBeInstanceOf(ArchivoVueloNoEncontradoError);
        expect(repo.archivo).toHaveBeenCalledWith(archivoId, id);
        expect(firmador.firmar).not.toHaveBeenCalled();
        expect(auditoria.registrar).not.toHaveBeenCalled();
    });
    it("no emite enlaces si falla la auditoría y usa cinco minutos", async () => {
        repo.archivo.mockResolvedValue(archivo);
        firmador.firmar.mockReturnValue("firmado");
        const inicio = Date.now();
        expect(await servicio.enlace(id, archivoId, "actor")).toMatchObject({
            urlContenido: "/api/vuelos/medios/firmado",
            urlMiniatura: null,
        });
        expect(firmador.firmar.mock.calls[0][2]).toBeGreaterThanOrEqual(inicio + 300000);
        expect(auditoria.registrar).toHaveBeenCalledWith({
            accion: "enlace_emitido",
            actorUsuarioId: "actor",
            vueloId: id,
            archivoId,
        });
        auditoria.registrar.mockRejectedValue(new Error("auditoria"));
        await expect(servicio.enlace(id, archivoId, "actor")).rejects.toThrow("auditoria");
    });
    it("borra filas antes del disco y no falla si el disco no responde", async () => {
        repo.eliminarAuditado.mockResolvedValue(true);
        disco.eliminarVuelo.mockRejectedValue(Object.assign(new Error("ruta secreta"), { code: "EACCES" }));
        await expect(servicio.eliminar(id, "actor")).resolves.toBeUndefined();
        expect(repo.eliminarAuditado.mock.invocationCallOrder[0]).toBeLessThan(
            disco.eliminarVuelo.mock.invocationCallOrder[0],
        );
    });
    it("omite rutas y crudos en listas y muestra crudos solo en detalle", () => {
        expect(vistaArchivo(archivo)).not.toHaveProperty("rutaAlmacenamiento");
        expect(vistaArchivo(archivo)).not.toHaveProperty("metadatosCrudos");
        expect(vistaArchivo(archivo, true)).toHaveProperty("metadatosCrudos.RtkFlag", 50);
    });
    it("consulta resúmenes del lote de vuelos sin pedir todos sus archivos", async () => {
        repo.listar.mockResolvedValue({ datos: [await repo.obtener(id)], total: 1, pagina: 1, limite: 20 });
        repo.resumen.mockResolvedValue({ [id]: { totalArchivos: 12 } });
        expect(await servicio.listar({})).toMatchObject({ datos: [{ id, resumen: { totalArchivos: 12 } }] });
        expect(repo.resumen).toHaveBeenCalledWith([id]);
        expect(repo.listarArchivos).not.toHaveBeenCalled();
    });
});
