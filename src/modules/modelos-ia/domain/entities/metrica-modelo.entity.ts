import { ReglaNegocioError } from "../../../../common/errors/regla-negocio.error";

export const MAX_LONGITUD_CLASE = 100;

// Rendimiento algorítmico de una compilación (RF-09.2). "clase" en null es la métrica global
// (macro); con valor, la de una clase concreta, como las tablas por clase de la memoria técnica.
export class MetricaModelo {
    constructor(
        public readonly clase: string | null,
        public readonly precision: number,
        public readonly recall: number,
        public readonly f1: number,
    ) {}

    public static crear(datos: {
        clase?: string | null;
        precision: number;
        recall: number;
        f1: number;
    }): MetricaModelo {
        const clase = datos.clase?.trim() || null;
        const nombre = clase ? `de la clase ${clase}` : "global";

        for (const [campo, valor] of Object.entries({
            precision: datos.precision,
            recall: datos.recall,
            f1: datos.f1,
        })) {
            if (!Number.isFinite(valor) || valor < 0 || valor > 1) {
                throw new ReglaNegocioError(`La métrica ${campo} ${nombre} debe estar entre 0 y 1.`);
            }
        }

        if (clase && clase.length > MAX_LONGITUD_CLASE) {
            throw new ReglaNegocioError(`El nombre de la clase no puede superar ${MAX_LONGITUD_CLASE} caracteres.`);
        }

        return new MetricaModelo(clase, datos.precision, datos.recall, datos.f1);
    }
}
