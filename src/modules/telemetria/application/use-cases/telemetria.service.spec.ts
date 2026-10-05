import { BadRequestException } from "@nestjs/common";
import { RegistrarEventoService } from "./registrar-evento.service";
import { ResumirTelemetriaService } from "./resumir-telemetria.service";
import type { ITelemetriaRepository } from "../../domain/ports/out/telemetria.repository";
import type { EventoTelemetria } from "../../domain/entities/evento-telemetria.entity";
import type { ConteoActualizacion, ConteoModelo, VentanaTiempo } from "../../domain/services/indicadores";
import { ReglaNegocioError } from "../../../../common/errors/regla-negocio.error";

// uuid se publica como ESM y Jest no lo carga: se reemplaza por el generador nativo
jest.mock("uuid", () => ({ v4: () => crypto.randomUUID() }));

describe("Telemetría - casos de uso", () => {
    let guardar: jest.Mock<Promise<void>, [EventoTelemetria]>;
    let contarPorModelo: jest.Mock<Promise<ConteoModelo[]>, [VentanaTiempo]>;
    let contarActualizaciones: jest.Mock<Promise<ConteoActualizacion[]>, [VentanaTiempo]>;
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
        repositorio = { guardar, contarPorModelo, contarActualizaciones };
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

        it("rechaza una ventana inválida sin consultar la base de datos", async () => {
            const hasta = new Date("2026-10-01");

            await expect(
                new ResumirTelemetriaService(repositorio).ejecutar({ desde: new Date("2026-10-05"), hasta }),
            ).rejects.toBeInstanceOf(ReglaNegocioError);
            expect(contarPorModelo).not.toHaveBeenCalled();
        });
    });
});
