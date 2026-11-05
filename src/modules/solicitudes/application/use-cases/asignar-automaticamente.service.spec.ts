import { AsignarAutomaticamenteService } from "./asignar-automaticamente.service";
import type { AsignarSolicitudService } from "./asignar-solicitud.service";
import { Solicitud, type EstadoSolicitud } from "../../domain/entities/solicitud.entity";
import type { PoliticaAsignacion } from "../../domain/ports/out/politica-asignacion.port";
import type { ISolicitudRepository } from "../../domain/ports/out/solicitud.repository";
import type { IAgronomoRepository } from "../../../agronomos/domain/ports/out/agronomo.repository";
import { Agronomo } from "../../../agronomos/domain/entities/agronomo.entity";

const crearSolicitud = (estado: EstadoSolicitud, agronomoId: string | null = null) =>
    new Solicitud("s-1", "p-1", agronomoId, estado, new Date(), "Pitalito", "El Cedro", "La Esperanza", 0.87, "m-1");

const crearAgronomo = (id: string) =>
    new Agronomo(id, `u-${id}`, id, `TP-${id}`, "+573001", `${id}@a.co`, "Fitopatología", "activo", new Date());

describe("AsignarAutomaticamenteService", () => {
    let politica: PoliticaAsignacion;
    let solicitud: Solicitud | null;
    let activos: Agronomo[];
    let carga: Map<string, number>;
    let asignar: jest.Mock<
        Promise<Solicitud>,
        [{ solicitudId: string; agronomoId: string; confirmarSobrecarga?: boolean }]
    >;

    beforeEach(() => {
        politica = { asignacionAutomatica: true, cargaMaxima: 3 };
        solicitud = crearSolicitud("Enviada");
        activos = [crearAgronomo("a-1"), crearAgronomo("a-2"), crearAgronomo("a-3")];
        carga = new Map([
            ["a-1", 2],
            ["a-2", 0],
            ["a-3", 1],
        ]);
        asignar = jest.fn((comando) => Promise.resolve(crearSolicitud("Asignada", comando.agronomoId)));
    });

    const ejecutar = () => {
        const agronomos = {
            findAll: () => Promise.resolve(activos),
            contarCasosActivos: () => Promise.resolve(carga),
        } as unknown as IAgronomoRepository;
        const solicitudes = { findById: () => Promise.resolve(solicitud) } as unknown as ISolicitudRepository;
        return new AsignarAutomaticamenteService({ obtener: () => Promise.resolve(politica) }, solicitudes, agronomos, {
            ejecutar: asignar,
        } as unknown as AsignarSolicitudService).ejecutar("s-1");
    };

    it("asigna al agrónomo activo con menos casos", async () => {
        await ejecutar();

        expect(asignar).toHaveBeenCalledWith({ solicitudId: "s-1", agronomoId: "a-2", confirmarSobrecarga: true });
    });

    it("no hace nada si la asignación automática está apagada", async () => {
        politica.asignacionAutomatica = false;

        await expect(ejecutar()).resolves.toBeNull();
        expect(asignar).not.toHaveBeenCalled();
    });

    it("salta a los agrónomos que ya llegaron a la carga máxima", async () => {
        carga = new Map([
            ["a-1", 3],
            ["a-2", 3],
            ["a-3", 2],
        ]);

        await ejecutar();

        expect(asignar.mock.calls[0][0].agronomoId).toBe("a-3");
    });

    it("deja la solicitud para el administrador si todos están al límite", async () => {
        carga = new Map([
            ["a-1", 3],
            ["a-2", 4],
            ["a-3", 3],
        ]);

        await expect(ejecutar()).resolves.toBeNull();
        expect(asignar).not.toHaveBeenCalled();
    });

    it("sin límite reparte entre todos aunque tengan muchos casos", async () => {
        politica.cargaMaxima = null;
        carga = new Map([
            ["a-1", 40],
            ["a-2", 50],
            ["a-3", 30],
        ]);

        await ejecutar();

        expect(asignar.mock.calls[0][0].agronomoId).toBe("a-3");
    });

    it("no hace nada si no hay agrónomos activos", async () => {
        activos = [];

        await expect(ejecutar()).resolves.toBeNull();
        expect(asignar).not.toHaveBeenCalled();
    });

    it.each<EstadoSolicitud>(["Pendiente", "Asignada", "Resuelta", "Descartada"])(
        "no toca una solicitud %s",
        async (estado) => {
            solicitud = crearSolicitud(estado, estado === "Asignada" ? "a-9" : null);

            await expect(ejecutar()).resolves.toBeNull();
            expect(asignar).not.toHaveBeenCalled();
        },
    );
});
