import { cubetaDispositivo, resolverModeloParaDispositivo } from "./asignacion-modelo";
import { ModeloIa } from "../entities/modelo-ia.entity";

const modelo = (canal: "canario" | "produccion", cambios: Partial<ModeloIa> = {}) =>
    Object.assign(
        new ModeloIa(
            canal,
            canal === "canario" ? "1.3.0" : "1.2.0",
            "tflite",
            canal,
            "2.0.0",
            null,
            {
                rutaModelo: "m",
                rutaEtiquetas: "e",
                rutaCalibracion: "c",
                tamanoBytes: 1,
                sha256: "x",
                firma: "f",
                numeroClases: 5,
            },
            "u-admin",
            new Date(),
            new Date(),
            canal === "canario" ? 50 : null,
        ),
        cambios,
    );

// Busca un deviceId cuya cubeta cumpla la condición: el hash es estable, así que el test también
const dispositivoCon = (condicion: (cubeta: number) => boolean) => {
    for (let i = 0; i < 1000; i++) {
        if (condicion(cubetaDispositivo(`telefono-${i}`))) return `telefono-${i}`;
    }
    throw new Error("No se encontró un dispositivo para la prueba");
};

describe("Asignación del modelo a cada dispositivo", () => {
    it("la cubeta es estable entre consultas y está entre 0 y 99", () => {
        const cubeta = cubetaDispositivo("telefono-de-ana");

        expect(cubetaDispositivo("telefono-de-ana")).toBe(cubeta);
        expect(cubeta).toBeGreaterThanOrEqual(0);
        expect(cubeta).toBeLessThan(100);
    });

    it("un dispositivo dentro del porcentaje recibe el canario", () => {
        const deviceId = dispositivoCon((cubeta) => cubeta < 50);

        const elegido = resolverModeloParaDispositivo(
            { canario: modelo("canario"), produccion: modelo("produccion") },
            { deviceId, appVersion: "2.1.0" },
        );

        expect(elegido?.version).toBe("1.3.0");
    });

    it("un dispositivo fuera del porcentaje sigue en producción", () => {
        const deviceId = dispositivoCon((cubeta) => cubeta >= 50);

        const elegido = resolverModeloParaDispositivo(
            { canario: modelo("canario"), produccion: modelo("produccion") },
            { deviceId, appVersion: "2.1.0" },
        );

        expect(elegido?.version).toBe("1.2.0");
    });

    it("una app más vieja que la que exige el canario sigue en producción", () => {
        const deviceId = dispositivoCon((cubeta) => cubeta < 50);

        const elegido = resolverModeloParaDispositivo(
            { canario: modelo("canario"), produccion: modelo("produccion") },
            { deviceId, appVersion: "1.9.9-debug" },
        );

        expect(elegido?.version).toBe("1.2.0");
    });

    it("un canario retirado con kill-switch deja de asignarse", () => {
        const deviceId = dispositivoCon((cubeta) => cubeta < 50);

        const elegido = resolverModeloParaDispositivo(
            { canario: modelo("canario", { killSwitch: true }), produccion: modelo("produccion") },
            { deviceId, appVersion: "2.1.0" },
        );

        expect(elegido?.version).toBe("1.2.0");
    });

    it("sin modelos publicados no hay nada que asignar", () => {
        expect(
            resolverModeloParaDispositivo({ canario: null, produccion: null }, { deviceId: "x", appVersion: "2.0.0" }),
        ).toBeNull();
    });
});
