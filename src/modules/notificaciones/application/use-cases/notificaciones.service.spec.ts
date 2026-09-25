import { NotFoundException } from "@nestjs/common";
import { CrearNotificacionesService } from "./crear-notificaciones.service";
import { ListarNotificacionesService } from "./listar-notificaciones.service";
import { ContarNoLeidasService } from "./contar-no-leidas.service";
import { MarcarNotificacionLeidaService } from "./marcar-notificacion-leida.service";
import { MarcarTodasLeidasService } from "./marcar-todas-leidas.service";
import { Notificacion, type TipoNotificacion } from "../../domain/entities/notificacion.entity";
import type { FiltrosNotificacion, INotificacionRepository } from "../../domain/ports/out/notificacion.repository";
import type { IConsultaUsuarios } from "../../domain/ports/out/consulta-usuarios.port";
import type { NuevaNotificacion } from "../../domain/ports/in/gestionar-notificaciones.port";

// uuid se publica como ESM y Jest no lo carga: se reemplaza por el generador nativo
jest.mock("uuid", () => ({ v4: () => crypto.randomUUID() }));

const AVISO: Omit<NuevaNotificacion, "usuarioId"> = {
    tipo: "mensaje_nuevo",
    titulo: "Nuevo mensaje en una solicitud",
    descripcion: "El agrónomo asignado escribió en el canal de coordinación.",
    referenciaTipo: "solicitud",
    referenciaId: "s-1",
};

const notificacionDe = (usuarioId: string, id = "n-1"): Notificacion => Notificacion.crear({ id, usuarioId, ...AVISO });

describe("Notificaciones - casos de uso", () => {
    let repositorio: jest.Mocked<INotificacionRepository>;
    let consultaUsuarios: jest.Mocked<IConsultaUsuarios>;
    // Mocks sueltos para las aserciones: evita referenciar métodos del objeto (unbound-method)
    let guardarVarias: jest.Mock<Promise<void>, [Notificacion[]]>;
    let existeNoLeida: jest.Mock<Promise<boolean>, [string, TipoNotificacion, string]>;
    let listarPorUsuario: jest.Mock<Promise<{ items: Notificacion[]; total: number }>, [string, FiltrosNotificacion]>;
    let guardar: jest.Mock<Promise<Notificacion>, [Notificacion]>;
    let findById: jest.Mock<Promise<Notificacion | null>, [string]>;
    let marcarTodasLeidas: jest.Mock<Promise<number>, [string]>;
    let listarIdsActivosPorRol: jest.Mock<Promise<string[]>, [string]>;

    beforeEach(() => {
        guardarVarias = jest.fn<Promise<void>, [Notificacion[]]>(() => Promise.resolve());
        existeNoLeida = jest.fn<Promise<boolean>, [string, TipoNotificacion, string]>(() => Promise.resolve(false));
        listarPorUsuario = jest.fn<Promise<{ items: Notificacion[]; total: number }>, [string, FiltrosNotificacion]>(
            () => Promise.resolve({ items: [notificacionDe("u-1")], total: 7 }),
        );
        guardar = jest.fn((notificacion: Notificacion) => Promise.resolve(notificacion));
        findById = jest.fn<Promise<Notificacion | null>, [string]>(() => Promise.resolve(notificacionDe("u-1")));
        marcarTodasLeidas = jest.fn<Promise<number>, [string]>(() => Promise.resolve(4));

        repositorio = {
            guardarVarias,
            findById,
            guardar,
            listarPorUsuario,
            contarNoLeidas: jest.fn().mockResolvedValue(3),
            marcarTodasLeidas,
            existeNoLeida,
        };
        listarIdsActivosPorRol = jest.fn<Promise<string[]>, [string]>(() =>
            Promise.resolve(["u-admin-1", "u-admin-2", "u-autor"]),
        );
        consultaUsuarios = { listarIdsActivosPorRol };
    });

    describe("CrearNotificacionesService", () => {
        const servicio = () => new CrearNotificacionesService(repositorio, consultaUsuarios);

        it("con un arreglo vacío devuelve 0 sin tocar el repositorio", async () => {
            const creadas = await servicio().ejecutar([], { evitarDuplicadasNoLeidas: true });

            expect(creadas).toBe(0);
            expect(existeNoLeida).not.toHaveBeenCalled();
            expect(guardarVarias).not.toHaveBeenCalled();
        });

        it("guarda todas las notificaciones en un solo lote", async () => {
            const creadas = await servicio().ejecutar([
                { ...AVISO, usuarioId: "u-1" },
                { ...AVISO, usuarioId: "u-2" },
            ]);

            expect(creadas).toBe(2);
            expect(guardarVarias).toHaveBeenCalledTimes(1);
            expect(guardarVarias.mock.calls[0][0].map((n) => n.usuarioId)).toEqual(["u-1", "u-2"]);
        });

        it("con evitarDuplicadasNoLeidas omite a quien ya tiene una no leída de la misma referencia", async () => {
            existeNoLeida.mockImplementation((usuarioId) => Promise.resolve(usuarioId === "u-1"));

            const creadas = await servicio().ejecutar(
                [
                    { ...AVISO, usuarioId: "u-1" },
                    { ...AVISO, usuarioId: "u-2" },
                ],
                { evitarDuplicadasNoLeidas: true },
            );

            expect(creadas).toBe(1);
            expect(existeNoLeida).toHaveBeenCalledWith("u-1", "mensaje_nuevo", "s-1");
            expect(guardarVarias.mock.calls[0][0].map((n) => n.usuarioId)).toEqual(["u-2"]);
        });

        it("si todos ya fueron avisados no guarda nada", async () => {
            existeNoLeida.mockResolvedValue(true);

            const creadas = await servicio().ejecutar([{ ...AVISO, usuarioId: "u-1" }], {
                evitarDuplicadasNoLeidas: true,
            });

            expect(creadas).toBe(0);
            expect(guardarVarias).not.toHaveBeenCalled();
        });

        it("sin evitarDuplicadasNoLeidas no consulta duplicados", async () => {
            await servicio().ejecutar([{ ...AVISO, usuarioId: "u-1" }]);

            expect(existeNoLeida).not.toHaveBeenCalled();
        });

        it("notificarRol avisa a las cuentas activas del rol y excluye al autor", async () => {
            const creadas = await servicio().notificarRol("admin", AVISO, { excluirUsuarioId: "u-autor" });

            expect(listarIdsActivosPorRol).toHaveBeenCalledWith("admin");
            expect(creadas).toBe(2);
            expect(guardarVarias.mock.calls[0][0].map((n) => n.usuarioId)).toEqual(["u-admin-1", "u-admin-2"]);
        });

        it("notificarRol sin destinatarios no guarda nada", async () => {
            listarIdsActivosPorRol.mockResolvedValue(["u-autor"]);

            const creadas = await servicio().notificarRol("admin", AVISO, { excluirUsuarioId: "u-autor" });

            expect(creadas).toBe(0);
            expect(guardarVarias).not.toHaveBeenCalled();
        });
    });

    describe("ListarNotificacionesService", () => {
        it("pasa la página y el límite al repositorio y devuelve el total", async () => {
            const pagina = await new ListarNotificacionesService(repositorio).ejecutar({
                usuarioId: "u-1",
                soloNoLeidas: true,
                pagina: 2,
                limite: 10,
            });

            expect(listarPorUsuario).toHaveBeenCalledWith("u-1", { soloNoLeidas: true, pagina: 2, limite: 10 });
            expect(pagina.total).toBe(7);
            expect(pagina.pagina).toBe(2);
            expect(pagina.limite).toBe(10);
            expect(pagina.items).toHaveLength(1);
        });

        it("no expone el usuarioId en la vista", async () => {
            const pagina = await new ListarNotificacionesService(repositorio).ejecutar({
                usuarioId: "u-1",
                pagina: 1,
                limite: 20,
            });

            expect(pagina.items[0]).not.toHaveProperty("usuarioId");
        });
    });

    describe("ContarNoLeidasService", () => {
        it("devuelve el total para la campana", async () => {
            await expect(new ContarNoLeidasService(repositorio).ejecutar({ usuarioId: "u-1" })).resolves.toEqual({
                total: 3,
            });
        });
    });

    describe("MarcarNotificacionLeidaService", () => {
        const marcar = (usuarioId: string) =>
            new MarcarNotificacionLeidaService(repositorio).ejecutar({ usuarioId, notificacionId: "n-1" });

        it("marca como leída la notificación propia (RF-02.6)", async () => {
            const vista = await marcar("u-1");

            expect(vista.leida).toBe(true);
            expect(guardar).toHaveBeenCalled();
        });

        it("devuelve 404 si la notificación es de otro usuario, sin revelar que existe", async () => {
            await expect(marcar("u-2")).rejects.toBeInstanceOf(NotFoundException);
            expect(guardar).not.toHaveBeenCalled();
        });

        it("devuelve 404 si la notificación no existe", async () => {
            findById.mockResolvedValue(null);

            await expect(marcar("u-1")).rejects.toBeInstanceOf(NotFoundException);
        });
    });

    describe("MarcarTodasLeidasService", () => {
        it("devuelve cuántas quedaron marcadas", async () => {
            await expect(new MarcarTodasLeidasService(repositorio).ejecutar({ usuarioId: "u-1" })).resolves.toEqual({
                marcadas: 4,
            });
            expect(marcarTodasLeidas).toHaveBeenCalledWith("u-1");
        });
    });
});
