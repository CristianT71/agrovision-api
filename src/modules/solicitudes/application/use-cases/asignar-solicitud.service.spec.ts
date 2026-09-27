import { ConflictException, Logger, NotFoundException } from "@nestjs/common";
import { AsignarSolicitudService } from "./asignar-solicitud.service";
import { Solicitud, type EstadoSolicitud } from "../../domain/entities/solicitud.entity";
import type { ISolicitudRepository } from "../../domain/ports/out/solicitud.repository";
import type { INotificadorSolicitudes } from "../../domain/ports/out/notificador-solicitudes.port";
import type { IAgronomoRepository } from "../../../agronomos/domain/ports/out/agronomo.repository";
import { Agronomo, type EstadoAgronomo } from "../../../agronomos/domain/entities/agronomo.entity";
import { ReglaNegocioError } from "../../../../common/errors/regla-negocio.error";

const crearSolicitud = (estado: EstadoSolicitud, agronomoId: string | null) =>
    new Solicitud("s-1", "p-1", agronomoId, estado, new Date(), "Pitalito", "El Cedro", "La Esperanza", 0.87, "m-1");

const crearAgronomo = (id: string, estado: EstadoAgronomo = "activo") =>
    new Agronomo(
        id,
        `u-${id}`,
        "Claudia Ríos",
        `TP-${id}`,
        "+573001",
        `${id}@a.co`,
        "Fitopatología",
        estado,
        new Date(),
    );

type Anterior = { estado: EstadoSolicitud; agronomoId: string | null };

describe("AsignarSolicitudService", () => {
    let solicitud: Solicitud | null;
    let agronomo: Agronomo | null;
    let guardarAsignacion: jest.Mock<Promise<boolean>, [Solicitud, Anterior]>;
    let notificarAsignacion: jest.Mock<Promise<void>, [{ solicitudId: string; agronomoUsuarioId: string }]>;
    let solicitudes: ISolicitudRepository;
    let agronomos: IAgronomoRepository;
    let notificador: INotificadorSolicitudes;

    beforeEach(() => {
        solicitud = crearSolicitud("Enviada", null);
        agronomo = crearAgronomo("a-1");
        guardarAsignacion = jest.fn<Promise<boolean>, [Solicitud, Anterior]>(() => Promise.resolve(true));
        notificarAsignacion = jest.fn<Promise<void>, [{ solicitudId: string; agronomoUsuarioId: string }]>(() =>
            Promise.resolve(),
        );

        solicitudes = {
            findById: () => Promise.resolve(solicitud),
            findAll: jest.fn(),
            guardar: jest.fn(),
            guardarResolucion: jest.fn(),
            guardarAsignacion,
        };
        agronomos = { findById: () => Promise.resolve(agronomo) } as unknown as IAgronomoRepository;
        notificador = { notificarAsignacion };
    });

    const asignar = (agronomoId = "a-1") =>
        new AsignarSolicitudService(solicitudes, agronomos, notificador).ejecutar({ solicitudId: "s-1", agronomoId });

    it("asigna una solicitud enviada y la deja Asignada", async () => {
        const asignada = await asignar();

        expect(asignada.estado).toBe("Asignada");
        expect(asignada.agronomoId).toBe("a-1");
        expect(guardarAsignacion).toHaveBeenCalledTimes(1);
    });

    it("pasa el estado anterior a guardarAsignacion", async () => {
        await asignar();

        expect(guardarAsignacion.mock.calls[0][1]).toEqual({ estado: "Enviada", agronomoId: null });
    });

    it("permite reasignar a otro agrónomo", async () => {
        solicitud = crearSolicitud("Asignada", "a-2");

        const asignada = await asignar();

        expect(asignada.agronomoId).toBe("a-1");
        expect(guardarAsignacion.mock.calls[0][1]).toEqual({ estado: "Asignada", agronomoId: "a-2" });
    });

    it("notifica al agrónomo con su usuarioId", async () => {
        await asignar();

        expect(notificarAsignacion).toHaveBeenCalledWith({ solicitudId: "s-1", agronomoUsuarioId: "u-a-1" });
    });

    it("responde 404 si la solicitud no existe", async () => {
        solicitud = null;

        await expect(asignar()).rejects.toBeInstanceOf(NotFoundException);
        expect(guardarAsignacion).not.toHaveBeenCalled();
    });

    it("responde 404 si el agrónomo no existe", async () => {
        agronomo = null;

        await expect(asignar()).rejects.toBeInstanceOf(NotFoundException);
        expect(guardarAsignacion).not.toHaveBeenCalled();
    });

    it.each<EstadoAgronomo>(["pendiente", "inactivo"])("no asigna a un agrónomo %s", async (estado) => {
        agronomo = crearAgronomo("a-1", estado);

        await expect(asignar()).rejects.toBeInstanceOf(ReglaNegocioError);
        expect(guardarAsignacion).not.toHaveBeenCalled();
    });

    it.each<EstadoSolicitud>(["Pendiente", "Resuelta", "Descartada"])("no asigna una solicitud %s", async (estado) => {
        solicitud = crearSolicitud(estado, null);

        await expect(asignar()).rejects.toBeInstanceOf(ReglaNegocioError);
        expect(guardarAsignacion).not.toHaveBeenCalled();
    });

    it("no reasigna al mismo agrónomo", async () => {
        solicitud = crearSolicitud("Asignada", "a-1");

        await expect(asignar()).rejects.toBeInstanceOf(ReglaNegocioError);
        expect(guardarAsignacion).not.toHaveBeenCalled();
    });

    it("responde 409 si otra petición la cambió primero y no notifica", async () => {
        guardarAsignacion.mockResolvedValue(false);

        await expect(asignar()).rejects.toBeInstanceOf(ConflictException);
        expect(notificarAsignacion).not.toHaveBeenCalled();
    });

    it("mantiene la asignación si el aviso falla", async () => {
        notificarAsignacion.mockRejectedValue(new Error("sin conexión"));
        const warn = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);

        const asignada = await asignar();

        expect(asignada.estado).toBe("Asignada");
        expect(guardarAsignacion).toHaveBeenCalledTimes(1);
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });
});
