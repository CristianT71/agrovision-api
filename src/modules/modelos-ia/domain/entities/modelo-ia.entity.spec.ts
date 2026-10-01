import { ModeloIa, type ArtefactosModelo, type Canal } from "./modelo-ia.entity";
import { MetricaModelo } from "./metrica-modelo.entity";
import { ReglaNegocioError } from "../../../../common/errors/regla-negocio.error";

const ARTEFACTOS: ArtefactosModelo = {
    rutaModelo: "modelos/1.0.0/a",
    rutaEtiquetas: "modelos/1.0.0/b",
    rutaCalibracion: "modelos/1.0.0/c",
    tamanoBytes: 4_900_000,
    sha256: "ab".repeat(32),
    firma: "firma-base64",
    numeroClases: 5,
};

const GLOBAL = MetricaModelo.crear({ precision: 0.98, recall: 0.97, f1: 0.98 });

const registrar = (cambios: Partial<Parameters<typeof ModeloIa.registrar>[0]> = {}) =>
    ModeloIa.registrar({
        id: "m-1",
        version: "1.2.0",
        formato: "tflite",
        versionMinApp: "2.0.0",
        artefactos: ARTEFACTOS,
        creadoPor: "u-admin",
        ...cambios,
    });

// Modelo listo para publicarse, llevado por el pipeline hasta el canal pedido
function modeloEn(canal: Canal, cambios: Partial<Parameters<typeof ModeloIa.registrar>[0]> = {}): ModeloIa {
    const modelo = registrar(cambios);
    modelo.registrarMetricas([GLOBAL]);
    const ruta: Canal[] = ["interno", "canario", "produccion"];
    for (const paso of ruta.slice(0, ruta.indexOf(canal) + 1)) {
        modelo.cambiarCanal(paso, { porcentajeCanario: 10 });
    }
    if (canal === "descontinuado") modelo.cambiarCanal("descontinuado");
    return modelo;
}

describe("ModeloIa", () => {
    describe("registrar", () => {
        it("entra al pipeline como borrador y sin publicar", () => {
            const modelo = registrar();

            expect(modelo.canal).toBe("borrador");
            expect(modelo.estaActivo()).toBe(false);
            expect(modelo.fechaPublicacion).toBeNull();
        });

        it.each(["1.2", "v1.2.0", "1.2.0-beta"])("rechaza la versión %s", (version) => {
            expect(() => registrar({ version })).toThrow(ReglaNegocioError);
        });
    });

    describe("registrarMetricas (RF-09.2)", () => {
        it("guarda la global y las de cada clase", () => {
            const modelo = registrar();
            modelo.registrarMetricas([
                GLOBAL,
                MetricaModelo.crear({ clase: "Sana", precision: 1, recall: 0.99, f1: 0.99 }),
            ]);

            expect(modelo.metricaGlobal()).toBe(GLOBAL);
            expect(modelo.metricas).toHaveLength(2);
        });

        it("exige exactamente una métrica global", () => {
            const clase = MetricaModelo.crear({ clase: "Sana", precision: 1, recall: 1, f1: 1 });

            expect(() => registrar().registrarMetricas([clase])).toThrow(ReglaNegocioError);
            expect(() => registrar().registrarMetricas([GLOBAL, GLOBAL])).toThrow(ReglaNegocioError);
        });

        it("rechaza valores fuera de 0 a 1", () => {
            expect(() => MetricaModelo.crear({ precision: 99.24, recall: 0.9, f1: 0.9 })).toThrow(ReglaNegocioError);
        });

        it("no admite más clases de las que tiene el modelo", () => {
            const modelo = registrar({ artefactos: { ...ARTEFACTOS, numeroClases: 1 } });
            const clases = ["A", "B"].map((clase) => MetricaModelo.crear({ clase, precision: 1, recall: 1, f1: 1 }));

            expect(() => modelo.registrarMetricas([GLOBAL, ...clases])).toThrow(ReglaNegocioError);
        });

        it("no reescribe las métricas de un modelo publicado", () => {
            expect(() => modeloEn("canario").registrarMetricas([GLOBAL])).toThrow(ReglaNegocioError);
        });
    });

    describe("cambiarCanal (RF-09.5)", () => {
        it("recorre borrador → interno → canario → producción y fecha la publicación", () => {
            const modelo = modeloEn("produccion");

            expect(modelo.canal).toBe("produccion");
            expect(modelo.estaActivo()).toBe(true);
            expect(modelo.fechaPublicacion).toBeInstanceOf(Date);
            expect(modelo.porcentajeCanario).toBeNull();
        });

        it("no se salta pasos del pipeline", () => {
            const modelo = registrar();
            modelo.registrarMetricas([GLOBAL]);

            expect(() => modelo.cambiarCanal("produccion")).toThrow(ReglaNegocioError);
        });

        it("el canario exige un porcentaje entre 1 y 50", () => {
            const modelo = modeloEn("interno");

            expect(() => modelo.cambiarCanal("canario")).toThrow(ReglaNegocioError);
            expect(() => modelo.cambiarCanal("canario", { porcentajeCanario: 80 })).toThrow(ReglaNegocioError);
        });

        it("permite ajustar el porcentaje del canario sin cambiar de canal", () => {
            const modelo = modeloEn("canario");
            modelo.cambiarCanal("canario", { porcentajeCanario: 25 });

            expect(modelo.porcentajeCanario).toBe(25);
        });

        it("no publica sin métricas", () => {
            const modelo = registrar();
            modelo.cambiarCanal("interno");

            expect(() => modelo.cambiarCanal("canario", { porcentajeCanario: 10 })).toThrow(ReglaNegocioError);
        });

        it("no publica un modelo sin firma", () => {
            const modelo = registrar({ artefactos: { ...ARTEFACTOS, firma: null } });
            modelo.registrarMetricas([GLOBAL]);
            modelo.cambiarCanal("interno");

            expect(() => modelo.cambiarCanal("canario", { porcentajeCanario: 10 })).toThrow(
                "MODEL_SIGNING_PRIVATE_KEY",
            );
        });

        it("un .pt nunca llega a los teléfonos", () => {
            const modelo = registrar({ formato: "pt" });
            modelo.registrarMetricas([GLOBAL]);
            modelo.cambiarCanal("interno");

            expect(() => modelo.cambiarCanal("canario", { porcentajeCanario: 10 })).toThrow(ReglaNegocioError);
        });

        it("cualquier canal se puede descontinuar, pero no se vuelve del descontinuado", () => {
            const modelo = modeloEn("canario");
            modelo.cambiarCanal("descontinuado");

            expect(modelo.estaActivo()).toBe(false);
            expect(() => modelo.cambiarCanal("interno")).toThrow(ReglaNegocioError);
        });
    });

    describe("activarKillSwitch (RF-09.3)", () => {
        const JUSTIFICACION = "Confunde Phoma con Minador en fotos reales";

        it("retira el modelo publicado y guarda la causa", () => {
            const modelo = modeloEn("produccion");
            modelo.activarKillSwitch(`  ${JUSTIFICACION}  `);

            expect(modelo.killSwitch).toBe(true);
            expect(modelo.estaActivo()).toBe(false);
            expect(modelo.motivoKillSwitch).toBe(JUSTIFICACION);
            expect(modelo.fechaKillSwitch).toBeInstanceOf(Date);
        });

        it("exige una justificación de al menos 20 caracteres", () => {
            expect(() => modeloEn("produccion").activarKillSwitch("falla")).toThrow(ReglaNegocioError);
        });

        it("solo aplica a modelos en canario o producción", () => {
            expect(() => modeloEn("interno").activarKillSwitch(JUSTIFICACION)).toThrow(ReglaNegocioError);
        });

        it("no se activa dos veces", () => {
            const modelo = modeloEn("canario");
            modelo.activarKillSwitch(JUSTIFICACION);

            expect(() => modelo.activarKillSwitch(JUSTIFICACION)).toThrow(ReglaNegocioError);
        });

        it("un modelo retirado solo puede descontinuarse", () => {
            const modelo = modeloEn("canario");
            modelo.activarKillSwitch(JUSTIFICACION);

            expect(() => modelo.cambiarCanal("produccion")).toThrow(ReglaNegocioError);
            modelo.cambiarCanal("descontinuado");
            expect(modelo.canal).toBe("descontinuado");
        });
    });

    describe("validarSucesorDe", () => {
        const produccion = () => modeloEn("produccion", { id: "m-prod", version: "1.2.0" });

        it("acepta una versión mayor que la de producción", () => {
            expect(() => registrar({ version: "1.10.0" }).validarSucesorDe(produccion())).not.toThrow();
        });

        it.each(["1.2.0", "1.1.9", "0.9.0"])("rechaza la versión %s: la app no la instalaría", (version) => {
            expect(() => registrar({ version }).validarSucesorDe(produccion())).toThrow(ReglaNegocioError);
        });

        it("sin producción vigente no hay con qué comparar", () => {
            expect(() => registrar({ version: "0.1.0" }).validarSucesorDe(null)).not.toThrow();
        });
    });
});
