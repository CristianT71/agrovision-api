import { CapturaInvalidaError, Deteccion, type DatosCaptura } from "./deteccion.entity";
import { categorizar } from "../services/categoria-biologica";
import { evaluarDivergencia } from "../services/divergencia";

const AHORA = new Date("2026-10-01T12:00:00Z");

const captura = (cambios: Partial<DatosCaptura> = {}): DatosCaptura => ({
    id: "d-1",
    idCliente: "c-1",
    productor: { id: "p-1", municipio: "Pitalito" },
    modelo: { id: "m-1", version: "1.2.0" },
    clasePredicha: "Enfermedad_Roya",
    confianza: 0.94,
    puntajeOod: 0.3,
    resultadoCompuerta: "IDENTIFIED",
    embedding: null,
    correccionProductor: null,
    confirmadaProductor: false,
    cultivo: "CAFE",
    organo: "HOJA",
    ubicacion: { latitud: 1.85, longitud: -76.05, precisionMetros: 12 },
    fecha: new Date("2026-09-30T08:00:00Z"),
    ...cambios,
});

describe("Detecciones - dominio", () => {
    describe("categorizar (RF-07.2)", () => {
        it.each([
            ["Enfermedad_Roya", "enfermedad"],
            ["Enfermedad_ManchadeHierro", "enfermedad"],
            ["Plaga_Minador", "plaga"],
            ["Deficiencia_Potasio", "deficiencia"],
            ["Sana", "sano"],
            // Clases de la memoria técnica, sin prefijo
            ["Leaf rust", "enfermedad"],
            ["Cerscospora", "enfermedad"],
            ["Otras_Enfermedades", "enfermedad"],
            ["Miner", "plaga"],
            ["Healthy", "sano"],
            ["Clase_Desconocida", "otra"],
        ])("%s es %s", (clase, categoria) => {
            expect(categorizar("IDENTIFIED", clase)).toBe(categoria);
        });

        it.each(["UNCERTAIN", "OOD", "QUALITY_REJECTED"] as const)(
            "una captura %s no cuenta como diagnóstico",
            (resultado) => {
                expect(categorizar(resultado, "Enfermedad_Roya")).toBe("no_reconocido");
            },
        );
    });

    describe("Deteccion.registrar (RF-07.1)", () => {
        it("guarda la inferencia con su categoría y el municipio del productor", () => {
            const deteccion = Deteccion.registrar(captura(), AHORA);

            expect(deteccion.categoria).toBe("enfermedad");
            expect(deteccion.municipio).toBe("Pitalito");
            expect(deteccion.defectuosa).toBe(false);
            expect(deteccion.recibidaEn).toBe(AHORA);
        });

        it("marca como defectuosa una confianza absoluta de cero (RF-07.4)", () => {
            expect(Deteccion.registrar(captura({ confianza: 0 }), AHORA).defectuosa).toBe(true);
        });

        it("una confianza nula (rechazada antes de clasificar) no es defectuosa", () => {
            const deteccion = Deteccion.registrar(
                captura({ confianza: null, resultadoCompuerta: "QUALITY_REJECTED", clasePredicha: null }),
                AHORA,
            );

            expect(deteccion.defectuosa).toBe(false);
            expect(deteccion.categoria).toBe("no_reconocido");
        });

        it.each([
            ["confianza_invalida", { confianza: 1.5 }],
            ["ood_invalido", { puntajeOod: Number.NaN }],
            ["clase_faltante", { clasePredicha: null }],
            ["fecha_invalida", { fecha: new Date("2026-10-05T00:00:00Z") }],
            ["ubicacion_invalida", { ubicacion: { latitud: 120, longitud: 0, precisionMetros: null } }],
        ] as const)("rechaza con %s", (codigo, cambios) => {
            expect(() => Deteccion.registrar(captura(cambios), AHORA)).toThrow(
                expect.objectContaining({ codigo }) as CapturaInvalidaError,
            );
        });
    });

    describe("evaluarDivergencia (RF-07.3)", () => {
        const roya = { categoria: "enfermedad" as const, clasePredicha: "Enfermedad_Roya" };
        const sinRevision = { correccionProductor: null, confirmadaProductor: false, resultadoAgronomo: null };

        it("sin intervención humana queda sin revisión", () => {
            expect(evaluarDivergencia(roya, sinRevision)).toEqual({ estado: "sin_revision", origen: null });
        });

        it("el productor corrige la clase: divergente", () => {
            expect(evaluarDivergencia(roya, { ...sinRevision, correccionProductor: "Plaga_Minador" })).toEqual({
                estado: "divergente",
                origen: "productor",
            });
        });

        it("el productor confirma: coincide", () => {
            expect(evaluarDivergencia(roya, { ...sinRevision, confirmadaProductor: true }).estado).toBe("coincide");
        });

        it("el agrónomo pesa más que el productor", () => {
            const revision = {
                correccionProductor: "Plaga_Minador",
                confirmadaProductor: false,
                resultadoAgronomo: "Confirma diagnóstico IA",
            };

            expect(evaluarDivergencia(roya, revision)).toEqual({ estado: "coincide", origen: "agronomo" });
        });

        it.each(["Corrige diagnóstico IA", "Plaga nueva"])("el agrónomo resuelve %s: divergente", (resultado) => {
            expect(evaluarDivergencia(roya, { ...sinRevision, resultadoAgronomo: resultado }).estado).toBe(
                "divergente",
            );
        });

        it("planta sana contradice a una predicción de enfermedad pero confirma una de sana", () => {
            const planta = { ...sinRevision, resultadoAgronomo: "Planta sana" };

            expect(evaluarDivergencia(roya, planta).estado).toBe("divergente");
            expect(evaluarDivergencia({ categoria: "sano", clasePredicha: "Sana" }, planta).estado).toBe("coincide");
        });

        it("una imagen no diagnosticable deja decidir al productor", () => {
            const revision = {
                correccionProductor: "Plaga_Minador",
                confirmadaProductor: false,
                resultadoAgronomo: "Imagen no diagnosticable",
            };

            expect(evaluarDivergencia(roya, revision)).toEqual({ estado: "divergente", origen: "productor" });
        });
    });
});
