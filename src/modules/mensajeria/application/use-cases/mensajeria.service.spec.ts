import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { EnviarMensajeService } from "./enviar-mensaje.service";
import { ListarMensajesService } from "./listar-mensajes.service";
import { MarcarMensajesLeidosService } from "./marcar-mensajes-leidos.service";
import { ContarMensajesPendientesService } from "./contar-mensajes-pendientes.service";
import { DescargarAdjuntoMensajeService } from "./descargar-adjunto-mensaje.service";
import { AdjuntoMensaje } from "../../domain/entities/adjunto-mensaje.entity";
import { Mensaje, type AutorTipo } from "../../domain/entities/mensaje.entity";
import type { ContextoSolicitud } from "../../domain/services/canal-coordinacion";
import type { IMensajeRepository, PendientesPorSolicitud } from "../../domain/ports/out/mensaje.repository";
import type { IConsultaSolicitudes } from "../../domain/ports/out/consulta-solicitudes.port";
import type { IConsultaAgronomos } from "../../domain/ports/out/consulta-agronomos.port";
import type { Actor } from "../../domain/ports/in/gestionar-mensajes.port";
import type {
    ArchivoParaGuardar,
    IAlmacenamientoArchivos,
} from "../../../../common/almacenamiento/almacenamiento.port";
import { ReglaNegocioError } from "../../../../common/errors/regla-negocio.error";

// uuid se publica como ESM y Jest no lo carga: se reemplaza por el generador nativo
jest.mock("uuid", () => ({ v4: () => crypto.randomUUID() }));

const PDF: ArchivoParaGuardar = {
    nombreOriginal: "instrucciones.pdf",
    tipoMime: "application/pdf",
    contenido: Buffer.from("%PDF"),
};

const ADMIN: Actor = { usuarioId: "u-admin", rol: "admin" };
const AGRONOMO: Actor = { usuarioId: "u-agro", rol: "agronomo" };
const PRODUCTOR: Actor = { usuarioId: "u-prod", rol: "productor" };

const SOLICITUD_ID = "s-1";
const CONTEXTO: ContextoSolicitud = { id: SOLICITUD_ID, agronomoId: "ag-1", estado: "Asignada" };

describe("Mensajería - casos de uso", () => {
    let repositorio: jest.Mocked<IMensajeRepository>;
    let consultaSolicitudes: jest.Mocked<IConsultaSolicitudes>;
    let consultaAgronomos: jest.Mocked<IConsultaAgronomos>;
    let almacenamiento: jest.Mocked<IAlmacenamientoArchivos>;
    // Mocks sueltos para las aserciones: evita referenciar métodos del objeto (unbound-method)
    let guardar: jest.Mock<Promise<Mensaje>, [Mensaje]>;
    let marcarLeidos: jest.Mock<Promise<number>, [string, AutorTipo]>;
    let contarPendientes: jest.Mock<Promise<PendientesPorSolicitud[]>, [AutorTipo, string[]?]>;
    let guardarPrivado: jest.Mock<Promise<string>, [string, ArchivoParaGuardar]>;
    let eliminarPrivado: jest.Mock<Promise<void>, [string]>;

    beforeEach(() => {
        guardar = jest.fn((mensaje: Mensaje) => Promise.resolve(mensaje));
        marcarLeidos = jest.fn<Promise<number>, [string, AutorTipo]>(() => Promise.resolve(2));
        contarPendientes = jest.fn<Promise<PendientesPorSolicitud[]>, [AutorTipo, string[]?]>(() =>
            Promise.resolve([]),
        );
        guardarPrivado = jest.fn<Promise<string>, [string, ArchivoParaGuardar]>(() =>
            Promise.resolve("mensajes/s-1/adjunto.pdf"),
        );
        eliminarPrivado = jest.fn<Promise<void>, [string]>(() => Promise.resolve());

        repositorio = {
            guardar,
            findById: jest.fn(),
            listarPorSolicitud: jest.fn().mockResolvedValue([]),
            marcarLeidos,
            contarPendientes,
        };
        consultaSolicitudes = {
            obtenerContexto: jest.fn().mockResolvedValue(CONTEXTO),
            listarIdsAsignadas: jest.fn().mockResolvedValue([SOLICITUD_ID]),
        };
        consultaAgronomos = {
            obtenerAgronomoIdPorUsuario: jest.fn().mockResolvedValue("ag-1"),
        };
        almacenamiento = {
            guardarPublico: jest.fn(),
            eliminarPublico: jest.fn(),
            guardarPrivado,
            leerPrivado: jest.fn().mockResolvedValue(Buffer.from("%PDF")),
            eliminarPrivado,
        };
    });

    describe("EnviarMensajeService", () => {
        const enviar = (actor: Actor, datos: { contenido?: string; archivos?: ArchivoParaGuardar[] } = {}) =>
            new EnviarMensajeService(repositorio, consultaSolicitudes, consultaAgronomos, almacenamiento).ejecutar({
                actor,
                solicitudId: SOLICITUD_ID,
                contenido: datos.contenido ?? "Prioriza este caso",
                archivos: datos.archivos ?? [],
            });

        it("el administrador escribe en el canal de cualquier solicitud asignada", async () => {
            const vista = await enviar(ADMIN);

            expect(vista.autorTipo).toBe("admin");
            expect(vista.autorId).toBe("u-admin");
            expect(guardar).toHaveBeenCalled();
        });

        it("el agrónomo asignado escribe en su canal", async () => {
            const vista = await enviar(AGRONOMO);

            expect(vista.autorTipo).toBe("agronomo");
        });

        it("guarda los adjuntos en almacenamiento privado sin exponer la ruta (RF-08.5)", async () => {
            const vista = await enviar(ADMIN, { archivos: [PDF] });

            expect(guardarPrivado).toHaveBeenCalledWith(`mensajes/${SOLICITUD_ID}`, PDF);
            expect(vista.adjuntos).toHaveLength(1);
            expect(vista.adjuntos[0]).not.toHaveProperty("ruta");
            expect(vista.adjuntos[0].tipo).toBe("documento");
        });

        it("niega el acceso al agrónomo que no tiene la solicitud asignada", async () => {
            consultaAgronomos.obtenerAgronomoIdPorUsuario.mockResolvedValue("ag-otro");

            await expect(enviar(AGRONOMO)).rejects.toBeInstanceOf(ForbiddenException);
            expect(guardar).not.toHaveBeenCalled();
        });

        it("niega el acceso al productor: el canal es interno", async () => {
            await expect(enviar(PRODUCTOR)).rejects.toBeInstanceOf(ForbiddenException);
        });

        it("devuelve 404 si la solicitud no existe", async () => {
            consultaSolicitudes.obtenerContexto.mockResolvedValue(null);

            await expect(enviar(ADMIN)).rejects.toBeInstanceOf(NotFoundException);
        });

        it("rechaza el envío sin agrónomo asignado y no sube archivos (RF-08.7)", async () => {
            consultaSolicitudes.obtenerContexto.mockResolvedValue({ ...CONTEXTO, agronomoId: null, estado: "Enviada" });

            await expect(enviar(ADMIN, { archivos: [PDF] })).rejects.toBeInstanceOf(ReglaNegocioError);
            expect(guardarPrivado).not.toHaveBeenCalled();
        });

        it("borra los archivos ya subidos si falla el guardado del mensaje", async () => {
            guardar.mockRejectedValue(new Error("fallo de base de datos"));

            await expect(enviar(ADMIN, { archivos: [PDF] })).rejects.toThrow("fallo de base de datos");
            expect(eliminarPrivado).toHaveBeenCalledWith("mensajes/s-1/adjunto.pdf");
        });
    });

    describe("ListarMensajesService", () => {
        it("no marca nada como leído al consultar la bitácora (RF-04.9)", async () => {
            repositorio.listarPorSolicitud.mockResolvedValue([
                Mensaje.crear({
                    id: "m-1",
                    solicitudId: SOLICITUD_ID,
                    autorId: "u-admin",
                    autorTipo: "admin",
                    contenido: "Prioriza este caso",
                }),
            ]);

            const mensajes = await new ListarMensajesService(
                repositorio,
                consultaSolicitudes,
                consultaAgronomos,
            ).ejecutar({ actor: AGRONOMO, solicitudId: SOLICITUD_ID });

            expect(mensajes).toHaveLength(1);
            expect(marcarLeidos).not.toHaveBeenCalled();
        });
    });

    describe("MarcarMensajesLeidosService", () => {
        const marcar = (actor: Actor) =>
            new MarcarMensajesLeidosService(repositorio, consultaSolicitudes, consultaAgronomos).ejecutar({
                actor,
                solicitudId: SOLICITUD_ID,
            });

        it("marca con el lector del administrador", async () => {
            const { marcados } = await marcar(ADMIN);

            expect(marcados).toBe(2);
            expect(marcarLeidos).toHaveBeenCalledWith(SOLICITUD_ID, "admin");
        });

        it("marca con el lector del agrónomo", async () => {
            await marcar(AGRONOMO);

            expect(marcarLeidos).toHaveBeenCalledWith(SOLICITUD_ID, "agronomo");
        });
    });

    describe("ContarMensajesPendientesService", () => {
        const contar = (actor: Actor) =>
            new ContarMensajesPendientesService(repositorio, consultaSolicitudes, consultaAgronomos).ejecutar({
                actor,
            });

        it("el agrónomo sin solicitudes asignadas no consulta el repositorio (RF-08.6)", async () => {
            consultaSolicitudes.listarIdsAsignadas.mockResolvedValue([]);

            const resumen = await contar(AGRONOMO);

            expect(resumen).toEqual({ total: 0, porSolicitud: [] });
            expect(contarPendientes).not.toHaveBeenCalled();
        });

        it("el total es la suma de los pendientes por solicitud y omite las que están al día", async () => {
            contarPendientes.mockResolvedValue([
                { solicitudId: "s-1", pendientes: 3 },
                { solicitudId: "s-2", pendientes: 0 },
                { solicitudId: "s-3", pendientes: 2 },
            ]);

            const resumen = await contar(ADMIN);

            expect(resumen.total).toBe(5);
            expect(resumen.porSolicitud).toEqual([
                { solicitudId: "s-1", pendientes: 3 },
                { solicitudId: "s-3", pendientes: 2 },
            ]);
            expect(contarPendientes).toHaveBeenCalledWith("admin");
        });

        it("el agrónomo solo cuenta en sus solicitudes asignadas", async () => {
            await contar(AGRONOMO);

            expect(contarPendientes).toHaveBeenCalledWith("agronomo", [SOLICITUD_ID]);
        });
    });

    describe("DescargarAdjuntoMensajeService", () => {
        const descargar = (mensajeId: string, adjuntoId: string) =>
            new DescargarAdjuntoMensajeService(
                repositorio,
                consultaSolicitudes,
                consultaAgronomos,
                almacenamiento,
            ).ejecutar({ actor: ADMIN, solicitudId: SOLICITUD_ID, mensajeId, adjuntoId });

        const mensajeCon = (solicitudId: string) =>
            new Mensaje("m-1", solicitudId, "u-admin", "admin", null, new Date(), false, [
                new AdjuntoMensaje("a-1", "m-1", "mensajes/s-9/x.pdf", "x.pdf", "application/pdf", 4, "documento"),
            ]);

        it("entrega el adjunto del mensaje de la solicitud", async () => {
            repositorio.findById.mockResolvedValue(mensajeCon(SOLICITUD_ID));

            const { adjunto, contenido } = await descargar("m-1", "a-1");

            expect(adjunto.nombreArchivo).toBe("x.pdf");
            expect(contenido).toEqual(Buffer.from("%PDF"));
        });

        it("devuelve 404 si el adjunto pertenece a otra solicitud", async () => {
            repositorio.findById.mockResolvedValue(mensajeCon("s-9"));

            await expect(descargar("m-1", "a-1")).rejects.toBeInstanceOf(NotFoundException);
        });

        it("devuelve 404 si el adjunto no pertenece a ese mensaje", async () => {
            repositorio.findById.mockResolvedValue(mensajeCon(SOLICITUD_ID));

            await expect(descargar("m-1", "a-otro")).rejects.toBeInstanceOf(NotFoundException);
        });
    });
});
