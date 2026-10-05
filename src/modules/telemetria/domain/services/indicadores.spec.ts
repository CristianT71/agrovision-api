import { calcularIndicadores, calcularTasaExito, resolverVentana } from "./indicadores";
import { ReglaNegocioError } from "../../../../common/errors/regla-negocio.error";

const AHORA = new Date("2026-10-05T12:00:00Z");
const DIA = 86_400_000;

describe("Indicadores de telemetría", () => {
    describe("resolverVentana (RF-06.1)", () => {
        it("sin fechas usa los últimos 7 días", () => {
            const ventana = resolverVentana(undefined, undefined, AHORA);

            expect(ventana.hasta).toEqual(AHORA);
            expect(AHORA.getTime() - ventana.desde.getTime()).toBe(7 * DIA);
        });

        it("rechaza desde posterior a hasta", () => {
            expect(() => resolverVentana(AHORA, new Date(AHORA.getTime() - DIA), AHORA)).toThrow(ReglaNegocioError);
        });

        it("rechaza ventanas de más de 90 días", () => {
            expect(() => resolverVentana(new Date(AHORA.getTime() - 91 * DIA), AHORA, AHORA)).toThrow(
                ReglaNegocioError,
            );
        });
    });

    describe("calcularIndicadores", () => {
        it("excluye los rechazos por calidad de la tasa de no reconocimiento", () => {
            const r = calcularIndicadores({
                versionModelo: "2.3.1",
                escaneos: 100,
                identificados: 72,
                rechazadosPorCalidad: 10,
                correcciones: 9,
                latenciaPromedioMs: 140,
            });

            // 90 evaluados, 18 sin reconocer
            expect(r.noReconocidos).toBe(18);
            expect(r.tasaNoReconocido).toBe(0.2);
            // 9 correcciones sobre 72 identificados
            expect(r.tasaCorreccion).toBe(0.125);
        });

        it("devuelve null en vez de dividir por cero", () => {
            const r = calcularIndicadores({
                versionModelo: "2.3.1",
                escaneos: 0,
                identificados: 0,
                rechazadosPorCalidad: 0,
                correcciones: 3,
                latenciaPromedioMs: null,
            });

            expect(r.tasaNoReconocido).toBeNull();
            expect(r.tasaCorreccion).toBeNull();
        });
    });

    describe("calcularTasaExito (RF-06.4)", () => {
        it("calcula la tasa de éxito de las actualizaciones", () => {
            expect(calcularTasaExito({ versionDestino: "2.3.1", exitos: 3, fallos: 1 }).tasaExito).toBe(0.75);
        });

        it("sin actualizaciones la tasa es null", () => {
            expect(calcularTasaExito({ versionDestino: "2.3.1", exitos: 0, fallos: 0 }).tasaExito).toBeNull();
        });
    });
});
