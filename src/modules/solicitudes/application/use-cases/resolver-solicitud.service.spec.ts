import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { ResolverSolicitudService } from "./resolver-solicitud.service";
import { ListarSolicitudesService } from "./listar-solicitudes.service";
import { Solicitud, type EstadoSolicitud } from "../../domain/entities/solicitud.entity";
import type { ISolicitudRepository, FiltrosSolicitud } from "../../domain/ports/out/solicitud.repository";
import type { IAgronomoRepository } from "../../../agronomos/domain/ports/out/agronomo.repository";
import { Agronomo, type EstadoAgronomo } from "../../../agronomos/domain/entities/agronomo.entity";
import { ReglaNegocioError } from "../../../../common/errors/regla-negocio.error";

const RESOLUCION = {
    respuestaProfesional: "Se confirma roya en estadio inicial, aplicar fungicida cúprico.",
    tipoResultado: "Confirma diagnóstico IA" as const,
    plagaIdentificada: "Roya del cafeto",
};

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

describe("Solicitudes - casos de uso", () => {
    let solicitud: Solicitud | null;
    let agronomo: Agronomo | null;
    let guardarResolucion: jest.Mock<Promise<boolean>, [Solicitud]>;
    let findAll: jest.Mock<Promise<Solicitud[]>, [FiltrosSolicitud?]>;
    let solicitudes: ISolicitudRepository;
    let agronomos: IAgronomoRepository;

    beforeEach(() => {
        solicitud = crearSolicitud("Asignada", "a-1");
        agronomo = crearAgronomo("a-1");
        guardarResolucion = jest.fn<Promise<boolean>, [Solicitud]>(() => Promise.resolve(true));
        findAll = jest.fn(() => Promise.resolve([]));

        solicitudes = {
            findById: () => Promise.resolve(solicitud),
            findAll,
            guardar: jest.fn(),
            guardarResolucion,
        };
        agronomos = { findByUsuarioId: () => Promise.resolve(agronomo) } as unknown as IAgronomoRepository;
    });

    describe("ResolverSolicitudService", () => {
        const resolver = () =>
            new ResolverSolicitudService(solicitudes, agronomos).ejecutar({
                solicitudId: "s-1",
                usuarioId: "u-a-1",
                ...RESOLUCION,
            });

        it("resuelve la solicitud asignada al agrónomo autenticado", async () => {
            await resolver();

            const guardada = guardarResolucion.mock.calls[0][0];
            expect(guardada.estado).toBe("Resuelta");
            expect(guardada.plagaIdentificada).toBe("Roya del cafeto");
            expect(guardada.fechaResolucion).toBeInstanceOf(Date);
        });

        it("no deja resolver una solicitud asignada a otro agrónomo", async () => {
            solicitud = crearSolicitud("Asignada", "a-2");

            await expect(resolver()).rejects.toBeInstanceOf(ForbiddenException);
            expect(guardarResolucion).not.toHaveBeenCalled();
        });

        it("no deja resolver a un agrónomo inactivo", async () => {
            agronomo = crearAgronomo("a-1", "inactivo");

            await expect(resolver()).rejects.toBeInstanceOf(ForbiddenException);
        });

        it("responde 404 si la solicitud no existe", async () => {
            solicitud = null;

            await expect(resolver()).rejects.toBeInstanceOf(NotFoundException);
        });

        it("impide modificar una solicitud ya resuelta (RF-04.8)", async () => {
            solicitud = crearSolicitud("Resuelta", "a-1");

            await expect(resolver()).rejects.toBeInstanceOf(ReglaNegocioError);
        });

        it("responde 409 si otra petición la resolvió primero", async () => {
            guardarResolucion.mockResolvedValue(false);

            await expect(resolver()).rejects.toBeInstanceOf(ConflictException);
        });
    });

    describe("ListarSolicitudesService", () => {
        const listar = (soloMias: boolean, rol: string) =>
            new ListarSolicitudesService(solicitudes, agronomos).ejecutar({
                soloMias,
                agronomoId: "a-otro",
                usuario: { id: "u-a-1", rol },
            });

        it("'mis asignadas' usa el agrónomo del token e ignora el enviado por el cliente", async () => {
            await listar(true, "agronomo");

            expect(findAll).toHaveBeenCalledWith(expect.objectContaining({ agronomoId: "a-1" }));
        });

        it("'mis asignadas' no aplica a administradores", async () => {
            await expect(listar(true, "admin")).rejects.toBeInstanceOf(ForbiddenException);
        });
    });
});
