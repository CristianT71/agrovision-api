import { detectarFormatoModelo, normalizarJson, validarCalibracion, validarEtiquetas } from "./artefactos-modelo";

const TFLITE = Buffer.concat([Buffer.from([0x18, 0, 0, 0]), Buffer.from("TFL3"), Buffer.alloc(16)]);

const etiquetasJson = (clases = ["Enfermedad_Roya", "Sana"]) =>
    Buffer.from(
        JSON.stringify({
            version: "1.0.0",
            class_count: clases.length,
            embedding_dim: 2,
            classes: clases.map((id, index) => ({ index, class_id: id, display_name: id, pest_id: null })),
        }),
    );

const calibracionJson = (cambios: Record<string, unknown> = {}) =>
    Buffer.from(
        JSON.stringify({
            version: "1.0.0",
            temperature: 1.4,
            confidence_threshold: 0.7,
            margin_threshold: 0.1,
            ood_threshold: 2.5,
            energy_weight: 0.5,
            energy_mean: -4,
            energy_std_dev: 1.2,
            class_centroids: [
                [0.1, 0.2],
                [0.3, 0.4],
            ],
            precision_matrix: [1, 0, 0, 1],
            ...cambios,
        }),
    );

describe("Artefactos del modelo", () => {
    describe("detectarFormatoModelo", () => {
        it("reconoce un .tflite por su identificador TFL3", () => {
            expect(detectarFormatoModelo(TFLITE)).toBe("tflite");
        });

        it("reconoce un .pt guardado como ZIP o como pickle", () => {
            expect(detectarFormatoModelo(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0]))).toBe("pt");
            expect(detectarFormatoModelo(Buffer.from([0x80, 0x02, 0x8a]))).toBe("pt");
        });

        it("rechaza cualquier otro archivo aunque se llame .tflite", () => {
            expect(detectarFormatoModelo(Buffer.from("%PDF-1.4 no es un modelo"))).toBeNull();
        });
    });

    it("normalizarJson quita el BOM que la app no vería al hashear", () => {
        const conBom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("{}")]);

        expect(normalizarJson(conBom).toString()).toBe("{}");
        expect(normalizarJson(Buffer.from("{}")).toString()).toBe("{}");
    });

    describe("validarEtiquetas", () => {
        it("resume las clases en el orden de sus índices", () => {
            const resultado = validarEtiquetas(etiquetasJson());

            expect(resultado).toEqual({
                resumen: { numeroClases: 2, dimensionEmbedding: 2, clases: ["Enfermedad_Roya", "Sana"] },
            });
        });

        it("rechaza índices con huecos: el modelo diría una clase por otra", () => {
            const json = JSON.parse(etiquetasJson().toString()) as { classes: { index: number }[] };
            json.classes[1].index = 5;

            expect(validarEtiquetas(Buffer.from(JSON.stringify(json)))).toHaveProperty("error");
        });

        it("rechaza class_id repetidos", () => {
            expect(validarEtiquetas(etiquetasJson(["Sana", "Sana"]))).toHaveProperty("error");
        });

        it("rechaza un archivo que no es JSON", () => {
            expect(validarEtiquetas(Buffer.from("no es json"))).toHaveProperty("error");
        });
    });

    describe("validarCalibracion", () => {
        const resumen = { numeroClases: 2, dimensionEmbedding: 2, clases: ["Enfermedad_Roya", "Sana"] };

        it("acepta una calibración coherente con las etiquetas", () => {
            expect(validarCalibracion(calibracionJson(), resumen)).toBeNull();
        });

        it("exige un centroide por clase", () => {
            expect(validarCalibracion(calibracionJson({ class_centroids: [[0.1, 0.2]] }), resumen)).not.toBeNull();
        });

        it("exige una matriz de precisión de d×d", () => {
            expect(validarCalibracion(calibracionJson({ precision_matrix: [1, 0, 0] }), resumen)).not.toBeNull();
        });

        it("exige temperatura positiva", () => {
            expect(validarCalibracion(calibracionJson({ temperature: 0 }), resumen)).not.toBeNull();
        });

        it("exige los umbrales de las compuertas", () => {
            expect(validarCalibracion(calibracionJson({ ood_threshold: "alto" }), resumen)).not.toBeNull();
        });
    });
});
