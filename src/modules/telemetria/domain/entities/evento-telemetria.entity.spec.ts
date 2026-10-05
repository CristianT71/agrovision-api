import { EventoTelemetria } from "./evento-telemetria.entity";
import { ReglaNegocioError } from "../../../../common/errors/regla-negocio.error";

const AHORA = new Date("2026-10-05T12:00:00Z");
const crear = (mapa: Record<string, unknown>) => EventoTelemetria.desdeMapa("e-1", mapa, AHORA);

const ESCANEO = {
    event: "scan",
    modelVersion: "2.3.1",
    outcome: "IDENTIFIED",
    confidence: "0.87",
    latencyMillis: "140",
    delegate: "gpu",
};

describe("EventoTelemetria (dominio)", () => {
    it("interpreta un escaneo convirtiendo los textos a números", () => {
        const { datos } = crear(ESCANEO);

        expect(datos.tipo).toBe("scan");
        expect(datos.resultado).toBe("IDENTIFIED");
        expect(datos.confianza).toBe(0.87);
        expect(datos.latenciaMs).toBe(140);
    });

    it("usa la hora del servidor si no viene occurredAt", () => {
        expect(crear(ESCANEO).datos.ocurridoEn).toEqual(AHORA);
    });

    it("respeta occurredAt en epoch ms", () => {
        const { datos } = crear({ ...ESCANEO, occurredAt: "1790000000000" });

        expect(datos.ocurridoEn.getTime()).toBe(1790000000000);
    });

    it("ignora las claves que no conoce", () => {
        expect(() => crear({ ...ESCANEO, campoNuevo: "x" })).not.toThrow();
    });

    it("interpreta una corrección", () => {
        const { datos } = crear({ event: "correction", modelVersion: "2.3.1", toClassId: "roya" });

        expect(datos.claseDestino).toBe("roya");
        expect(datos.claseOrigen).toBeNull();
    });

    it("interpreta una actualización de modelo con su éxito", () => {
        const { datos } = crear({ event: "model_update", fromVersion: "2.3.0", toVersion: "2.3.1", success: "false" });

        expect(datos.versionDestino).toBe("2.3.1");
        expect(datos.exito).toBe(false);
    });

    it.each([
        ["evento desconocido", { event: "otro" }],
        ["escaneo sin versión de modelo", { ...ESCANEO, modelVersion: undefined }],
        ["resultado inválido", { ...ESCANEO, outcome: "QUIZAS" }],
        ["confianza mayor que 1", { ...ESCANEO, confidence: "1.5" }],
        ["latencia que no es número", { ...ESCANEO, latencyMillis: "rapido" }],
        ["latencia con decimales", { ...ESCANEO, latencyMillis: "12.5" }],
        ["corrección sin clase destino", { event: "correction", modelVersion: "2.3.1" }],
        ["success que no es true ni false", { event: "model_update", toVersion: "2.3.1", success: "si" }],
        ["un valor que no es texto", { ...ESCANEO, latencyMillis: 140 }],
        ["fecha en el futuro", { ...ESCANEO, occurredAt: String(AHORA.getTime() + 3_600_000) }],
    ])("rechaza %s", (_caso, mapa) => {
        expect(() => crear(mapa)).toThrow(ReglaNegocioError);
    });
});
