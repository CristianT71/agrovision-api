import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { ObtenerPermisoContactoService } from "./obtener-permiso-contacto.service";
import { OtorgarPermisoContactoService } from "./otorgar-permiso-contacto.service";
import { RevocarPermisoContactoService } from "./revocar-permiso-contacto.service";
import { ObtenerContactoProductorService } from "./obtener-contacto-productor.service";
import { PermisoContacto, type ContextoSolicitud } from "../../domain/entities/permiso-contacto.entity";
import type { IPermisoContactoRepository } from "../../domain/ports/out/permiso-contacto.repository";
import type { IConsultaSolicitudes } from "../../domain/ports/out/consulta-solicitudes.port";
import type { IConsultaAgronomos } from "../../domain/ports/out/consulta-agronomos.port";
import type { IConsultaProductores } from "../../domain/ports/out/consulta-productores.port";
import type { INotificadorPermisos } from "../../domain/ports/out/notificador-permisos.port";
import type { Actor } from "../../domain/ports/in/gestionar-permisos-contacto.port";
import { ReglaNegocioError } from "../../../../common/errors/regla-negocio.error";

// uuid se publica como ESM y Jest no lo carga: se reemplaza por el generador nativo
jest.mock("uuid", () => ({ v4: () => crypto.randomUUID() }));

const ADMIN: Actor = { usuarioId: "u-admin", rol: "admin" };
const AGRONOMO: Actor = { usuarioId: "u-agro", rol: "agronomo" };
const PRODUCTOR: Actor = { usuarioId: "u-prod", rol: "productor" };

const SOLICITUD_ID = "s-1";
const CONTEXTO: ContextoSolicitud = { id: SOLICITUD_ID, productorId: "p-1", agronomoId: "ag-1", estado: "Asignada" };

type Aviso = { solicitudId: string; agronomoUsuarioId: string };

const permisoOtorgadoA = (agronomoId: string) => {
    const permiso = PermisoContacto.sinOtorgar("pc-1", SOLICITUD_ID);
    permiso.otorgar({ ...CONTEXTO, agronomoId }, "u-admin");
    return permiso;
};

describe("Permisos de contacto - casos de uso", () => {
    let repositorio: jest.Mocked<IPermisoContactoRepository>;
    let consultaSolicitudes: jest.Mocked<IConsultaSolicitudes>;
    let consultaAgronomos: jest.Mocked<IConsultaAgronomos>;
    let consultaProductores: jest.Mocked<IConsultaProductores>;
    let notificador: jest.Mocked<INotificadorPermisos>;
    // Mocks sueltos para las aserciones: evita referenciar métodos del objeto (unbound-method)
    let guardar: jest.Mock<Promise<PermisoContacto>, [PermisoContacto]>;
    let obtenerContacto: jest.Mock;
    let notificarPermisoOtorgado: jest.Mock<Promise<void>, [Aviso]>;
    let notificarPermisoRevocado: jest.Mock<Promise<void>, [Aviso]>;

    beforeEach(() => {
        guardar = jest.fn((permiso: PermisoContacto) => Promise.resolve(permiso));
        obtenerContacto = jest.fn().mockResolvedValue({ nombre: "Ana Pérez", telefono: "+573001234567" });
        notificarPermisoOtorgado = jest.fn<Promise<void>, [Aviso]>(() => Promise.resolve());
        notificarPermisoRevocado = jest.fn<Promise<void>, [Aviso]>(() => Promise.resolve());

        repositorio = {
            findBySolicitudId: jest.fn().mockResolvedValue(null),
            guardar,
        };
        consultaSolicitudes = {
            obtenerContexto: jest.fn().mockResolvedValue(CONTEXTO),
        };
        consultaAgronomos = {
            obtenerAgronomoIdPorUsuario: jest.fn().mockResolvedValue("ag-1"),
            obtenerUsuarioIdPorAgronomo: jest.fn().mockResolvedValue("u-agro"),
        };
        consultaProductores = { obtenerContacto };
        notificador = { notificarPermisoOtorgado, notificarPermisoRevocado };
    });

    describe("OtorgarPermisoContactoService", () => {
        const otorgar = () =>
            new OtorgarPermisoContactoService(
                repositorio,
                consultaSolicitudes,
                consultaAgronomos,
                notificador,
            ).ejecutar({ adminUsuarioId: "u-admin", solicitudId: SOLICITUD_ID });

        it("crea el permiso de la solicitud y lo deja habilitado (RF-08.8)", async () => {
            const vista = await otorgar();

            expect(vista.habilitado).toBe(true);
            expect(vista.agronomoId).toBe("ag-1");
            expect(vista.otorgadoPor).toBe("u-admin");
            expect(guardar).toHaveBeenCalled();
        });

        it("reutiliza la fila existente de la solicitud", async () => {
            const existente = permisoOtorgadoA("ag-1");
            existente.revocar("u-admin");
            repositorio.findBySolicitudId.mockResolvedValue(existente);

            await otorgar();

            expect(guardar).toHaveBeenCalledWith(existente);
        });

        it("avisa al agrónomo en su cuenta de login", async () => {
            await otorgar();

            expect(notificarPermisoOtorgado).toHaveBeenCalledWith({
                solicitudId: SOLICITUD_ID,
                agronomoUsuarioId: "u-agro",
            });
        });

        it("si el aviso falla, el permiso queda otorgado", async () => {
            notificarPermisoOtorgado.mockRejectedValue(new Error("fallo de notificaciones"));

            const vista = await otorgar();

            expect(vista.habilitado).toBe(true);
        });

        it("rechaza una solicitud sin agrónomo asignado y no guarda nada", async () => {
            consultaSolicitudes.obtenerContexto.mockResolvedValue({ ...CONTEXTO, agronomoId: null, estado: "Enviada" });

            await expect(otorgar()).rejects.toBeInstanceOf(ReglaNegocioError);
            expect(guardar).not.toHaveBeenCalled();
            expect(notificarPermisoOtorgado).not.toHaveBeenCalled();
        });

        it("devuelve 404 si la solicitud no existe", async () => {
            consultaSolicitudes.obtenerContexto.mockResolvedValue(null);

            await expect(otorgar()).rejects.toBeInstanceOf(NotFoundException);
        });
    });

    describe("RevocarPermisoContactoService", () => {
        const revocar = () =>
            new RevocarPermisoContactoService(
                repositorio,
                consultaSolicitudes,
                consultaAgronomos,
                notificador,
            ).ejecutar({ adminUsuarioId: "u-admin", solicitudId: SOLICITUD_ID });

        it("extingue el permiso y avisa al agrónomo que lo tenía", async () => {
            repositorio.findBySolicitudId.mockResolvedValue(permisoOtorgadoA("ag-1"));

            const vista = await revocar();

            expect(vista.habilitado).toBe(false);
            expect(vista.revocadoPor).toBe("u-admin");
            expect(notificarPermisoRevocado).toHaveBeenCalledWith({
                solicitudId: SOLICITUD_ID,
                agronomoUsuarioId: "u-agro",
            });
        });

        it("rechaza revocar si la solicitud nunca tuvo permiso", async () => {
            await expect(revocar()).rejects.toBeInstanceOf(ReglaNegocioError);
            expect(guardar).not.toHaveBeenCalled();
        });
    });

    describe("ObtenerPermisoContactoService", () => {
        const obtener = (actor: Actor) =>
            new ObtenerPermisoContactoService(repositorio, consultaSolicitudes, consultaAgronomos).ejecutar({
                actor,
                solicitudId: SOLICITUD_ID,
            });

        it("sin permiso registrado responde como no otorgado y no crea filas", async () => {
            const vista = await obtener(ADMIN);

            expect(vista).toEqual({
                solicitudId: SOLICITUD_ID,
                habilitado: false,
                agronomoId: null,
                otorgadoPor: null,
                fechaOtorgado: null,
                revocadoPor: null,
                fechaRevocado: null,
            });
            expect(guardar).not.toHaveBeenCalled();
        });

        it("un permiso de un evaluador anterior no se muestra como habilitado", async () => {
            repositorio.findBySolicitudId.mockResolvedValue(permisoOtorgadoA("ag-anterior"));

            const vista = await obtener(ADMIN);

            expect(vista.habilitado).toBe(false);
            expect(vista.agronomoId).toBe("ag-anterior");
        });

        it("el agrónomo asignado consulta el estado de su permiso", async () => {
            repositorio.findBySolicitudId.mockResolvedValue(permisoOtorgadoA("ag-1"));

            const vista = await obtener(AGRONOMO);

            expect(vista.habilitado).toBe(true);
        });

        it("niega la consulta al agrónomo que no tiene la solicitud asignada", async () => {
            consultaAgronomos.obtenerAgronomoIdPorUsuario.mockResolvedValue("ag-otro");

            await expect(obtener(AGRONOMO)).rejects.toBeInstanceOf(ForbiddenException);
        });

        it("niega la consulta al productor", async () => {
            await expect(obtener(PRODUCTOR)).rejects.toBeInstanceOf(ForbiddenException);
        });
    });

    describe("ObtenerContactoProductorService", () => {
        const contacto = (actor: Actor) =>
            new ObtenerContactoProductorService(
                repositorio,
                consultaSolicitudes,
                consultaAgronomos,
                consultaProductores,
            ).ejecutar({ actor, solicitudId: SOLICITUD_ID });

        it("entrega el teléfono al agrónomo con el permiso vigente (RF-04.10)", async () => {
            repositorio.findBySolicitudId.mockResolvedValue(permisoOtorgadoA("ag-1"));

            const vista = await contacto(AGRONOMO);

            expect(vista).toEqual({
                solicitudId: SOLICITUD_ID,
                productorNombre: "Ana Pérez",
                telefono: "+573001234567",
            });
            expect(obtenerContacto).toHaveBeenCalledWith("p-1");
        });

        it("niega el teléfono al agrónomo sin permiso y no consulta al productor", async () => {
            await expect(contacto(AGRONOMO)).rejects.toBeInstanceOf(ForbiddenException);
            expect(obtenerContacto).not.toHaveBeenCalled();
        });

        it("niega el teléfono si el permiso fue revocado", async () => {
            const permiso = permisoOtorgadoA("ag-1");
            permiso.revocar("u-admin");
            repositorio.findBySolicitudId.mockResolvedValue(permiso);

            await expect(contacto(AGRONOMO)).rejects.toBeInstanceOf(ForbiddenException);
        });

        it("niega el teléfono al nuevo agrónomo tras una reasignación", async () => {
            repositorio.findBySolicitudId.mockResolvedValue(permisoOtorgadoA("ag-anterior"));

            await expect(contacto(AGRONOMO)).rejects.toBeInstanceOf(ForbiddenException);
        });

        it("el administrador lo consulta sin permiso: es quien lo otorga", async () => {
            const vista = await contacto(ADMIN);

            expect(vista.telefono).toBe("+573001234567");
        });

        it("devuelve 404 si el productor no existe", async () => {
            obtenerContacto.mockResolvedValue(null);

            await expect(contacto(ADMIN)).rejects.toBeInstanceOf(NotFoundException);
        });
    });
});
