import { BadRequestException } from "@nestjs/common";
import { RegistrarEventoService } from "./registrar-evento.service";
import { ResumirTelemetriaService } from "./resumir-telemetria.service";
import type { ITelemetriaRepository } from "../../domain/ports/out/telemetria.repository";
import type { EventoTelemetria } from "../../domain/entities/evento-telemetria.entity";
import type {
    ConteoActualizacion,
    ConteoDiaModelo,
    ConteoModelo,
    VentanaTiempo,
} from "../../domain/services/indicadores";
import { ReglaNegocioError } from "../../../../common/errors/regla-negocio.error";

// uuid se publica como ESM y Jest no lo carga: se reemplaza por el generador nativo
jest.mock("uuid", () => ({ v4: () => crypto.randomUUID() }));

describe("Telemetría - casos de uso", () => {
    let guardar: jest.Mock<Promise<void>, [EventoTelemetria]>;
    let contarPorModelo: jest.Mock<Promise<ConteoModelo[]>, [VentanaTiempo]>;
    let contarActualizaciones: jest.Mock<Promise<ConteoActualizacion[]>, [VentanaTiempo]>;
    let contarPorDiaYModelo: jest.Mock<Promise<ConteoDiaModelo[]>, [VentanaTiempo]>;
    let repositorio: ITelemetriaRepository;

    beforeEach(() => {
        guardar = jest.fn<Promise<void>, [EventoTelemetria]>(() => Promise.resolve());
        contarPorModelo = jest.fn<Promise<ConteoModelo[]>, [VentanaTiempo]>(() =>
            Promise.resolve([
                {
                    versionModelo: "2.3.1",
                    escaneos: 10,
                    identificados: 8,
                    rechazadosPorCalidad: 0,
                    correcciones: 2,
                    latenciaPromedioMs: 120,
                },
            ]),
        );
        contarActualizaciones = jest.fn<Promise<ConteoActualizacion[]>, [VentanaTiempo]>(() =>
            Promise.resolve([{ versionDestino: "2.3.1", exitos: 4, fallos: 0 }]),
        );
        contarPorDiaYModelo = jest.fn<Promise<ConteoDiaModelo[]>, [VentanaTiempo]>(() =>
            Promise.resolve([
                {
                    dia: "2026-10-03",
                    versionModelo: "2.3.1",
                    escaneos: 6,
                    identificados: 4,
                    rechazadosPorCalidad: 1,
                    correcciones: 1,
                },
                {
                    dia: "2026-10-04",
                    versionModelo: "2.3.1",
                    escaneos: 4,
                    identificados: 4,
                    rechazadosPorCalidad: 0,
                    correcciones: 0,
                },
            ]),
        );
        repositorio = { guardar, contarPorModelo, contarActualizaciones, contarPorDiaYModelo };
    });

    describe("RegistrarEventoService", () => {
        it("guarda un evento válido", async () => {
            await new RegistrarEventoService(repositorio).ejecutar({
                event: "model_update",
                toVersion: "2.3.1",
                success: "true",
            });

            expect(guardar).toHaveBeenCalledTimes(1);
            expect(guardar.mock.calls[0][0].datos.exito).toBe(true);
        });

        it("responde 400 si el evento está mal formado y no guarda nada", async () => {
            await expect(new RegistrarEventoService(repositorio).ejecutar({ event: "otro" })).rejects.toBeInstanceOf(
                BadRequestException,
            );
            expect(guardar).not.toHaveBeenCalled();
        });
    });

    describe("ResumirTelemetriaService", () => {
        it("consulta la misma ventana en ambos conteos y calcula las tasas", async () => {
            const resumen = await new ResumirTelemetriaService(repositorio).ejecutar({});

            expect(contarPorModelo.mock.calls[0][0]).toEqual(contarActualizaciones.mock.calls[0][0]);
            expect(resumen.porModelo[0].tasaNoReconocido).toBe(0.2);
            expect(resumen.porModelo[0].tasaCorreccion).toBe(0.25);
            expect(resumen.actualizaciones[0].tasaExito).toBe(1);
        });

        it("arma la serie diaria con la misma ventana y sin contar los rechazos por calidad", async () => {
            const resumen = await new ResumirTelemetriaService(repositorio).ejecutar({});

            expect(contarPorDiaYModelo.mock.calls[0][0]).toEqual(contarPorModelo.mock.calls[0][0]);
            expect(resumen.serie).toEqual([
                {
                    dia: "2026-10-03",
                    versionModelo: "2.3.1",
                    escaneos: 6,
                    noReconocidos: 1,
                    tasaNoReconocido: 0.2,
                    correcciones: 1,
                },
                {
                    dia: "2026-10-04",
                    versionModelo: "2.3.1",
                    escaneos: 4,
                    noReconocidos: 0,
                    tasaNoReconocido: 0,
                    correcciones: 0,
                },
            ]);
        });

        it("sin eventos en la ventana la serie queda vacía", async () => {
            contarPorDiaYModelo.mockResolvedValue([]);

            const resumen = await new ResumirTelemetriaService(repositorio).ejecutar({});

            expect(resumen.serie).toEqual([]);
        });

        it("rechaza una ventana inválida sin consultar la base de datos", async () => {
            const hasta = new Date("2026-10-01");

            await expect(
                new ResumirTelemetriaService(repositorio).ejecutar({ desde: new Date("2026-10-05"), hasta }),
            ).rejects.toBeInstanceOf(ReglaNegocioError);
            expect(contarPorModelo).not.toHaveBeenCalled();
            expect(contarPorDiaYModelo).not.toHaveBeenCalled();
        });
    });
});
