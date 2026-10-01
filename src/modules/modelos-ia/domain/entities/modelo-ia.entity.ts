import { ReglaNegocioError } from "../../../../common/errors/regla-negocio.error";
import type { MetricaModelo } from "./metrica-modelo.entity";

// Entornos de publicación del modelo (documento de base de datos, RF-09.1)
export const CANALES = ["borrador", "interno", "canario", "produccion", "descontinuado"] as const;
export type Canal = (typeof CANALES)[number];

// RF-09.5: artefactos tensoriales admitidos. Solo .tflite corre en el teléfono;
// .pt se guarda como referencia (por ejemplo, el Teacher) y nunca sale a la app.
export const FORMATOS_MODELO = ["tflite", "pt"] as const;
export type FormatoModelo = (typeof FORMATOS_MODELO)[number];

// Versión semántica sin sufijos: la app la compara número a número
export const FORMATO_VERSION = /^\d{1,4}\.\d{1,4}\.\d{1,4}$/;
export const MAX_LONGITUD_NOTAS = 1000;

// Dónde quedó cada archivo y con qué huella. Las rutas nunca salen de la API.
export interface ArtefactosModelo {
    rutaModelo: string;
    rutaEtiquetas: string | null;
    rutaCalibracion: string | null;
    tamanoBytes: number;
    sha256: string;
    // Ed25519 sobre el conjunto modelo + etiquetas + calibración; null si no se pudo firmar
    firma: string | null;
    numeroClases: number | null;
}

export class ModeloIa {
    constructor(
        public readonly id: string,
        public readonly version: string,
        public readonly formato: FormatoModelo,
        public canal: Canal,
        public readonly versionMinApp: string,
        public readonly notas: string | null,
        public readonly artefactos: ArtefactosModelo,
        // Cuenta de login (usuarios.id) del administrador que lo subió
        public readonly creadoPor: string,
        public readonly fechaCreacion: Date,
        // Primera vez que llegó a dispositivos reales (canario o producción)
        public fechaPublicacion: Date | null = null,
        public porcentajeCanario: number | null = null,
        public killSwitch: boolean = false,
        public motivoKillSwitch: string | null = null,
        public fechaKillSwitch: Date | null = null,
        public metricas: MetricaModelo[] = [],
    ) {}

    // Regla de Negocio (RF-09.5): todo modelo nuevo entra al pipeline como borrador
    public static registrar(datos: {
        id: string;
        version: string;
        formato: FormatoModelo;
        versionMinApp: string;
        notas?: string | null;
        artefactos: ArtefactosModelo;
        creadoPor: string;
    }): ModeloIa {
        if (!FORMATO_VERSION.test(datos.version)) {
            throw new ReglaNegocioError("La versión del modelo debe tener el formato 1.2.3.");
        }

        if (!FORMATO_VERSION.test(datos.versionMinApp)) {
            throw new ReglaNegocioError("La versión mínima de la app debe tener el formato 1.2.3.");
        }

        const notas = datos.notas?.trim() || null;
        if (notas && notas.length > MAX_LONGITUD_NOTAS) {
            throw new ReglaNegocioError(`Las notas no pueden superar ${MAX_LONGITUD_NOTAS} caracteres.`);
        }

        return new ModeloIa(
            datos.id,
            datos.version,
            datos.formato,
            "borrador",
            datos.versionMinApp,
            notas,
            datos.artefactos,
            datos.creadoPor,
            new Date(),
        );
    }

    // Regla de Negocio (RF-09.2): una métrica global y, opcionalmente, una por clase.
    // Se reemplazan completas; una vez el modelo llega a dispositivos ya no se reescriben.
    public registrarMetricas(metricas: MetricaModelo[]): void {
        if (this.canal !== "borrador" && this.canal !== "interno") {
            throw new ReglaNegocioError("Las métricas de un modelo publicado o descontinuado no se pueden cambiar.");
        }

        const globales = metricas.filter((metrica) => metrica.clase === null);
        if (globales.length !== 1) {
            throw new ReglaNegocioError("Debe registrarse exactamente una métrica global del modelo.");
        }

        const clases = metricas.filter((metrica) => metrica.clase !== null).map((metrica) => metrica.clase);
        if (new Set(clases).size !== clases.length) {
            throw new ReglaNegocioError("Cada clase solo puede tener una métrica.");
        }

        const { numeroClases } = this.artefactos;
        if (numeroClases !== null && clases.length > numeroClases) {
            throw new ReglaNegocioError(`El modelo tiene ${numeroClases} clases: no admite más métricas por clase.`);
        }

        this.metricas = metricas;
    }

    public metricaGlobal(): MetricaModelo | null {
        return this.metricas.find((metrica) => metrica.clase === null) ?? null;
    }

    // Lo que ve un dispositivo: publicado en canario o producción y sin kill-switch
    public estaActivo(): boolean {
        return (this.canal === "canario" || this.canal === "produccion") && !this.killSwitch;
    }

    // La app no puede activar un modelo sin etiquetas, calibración y firma (§7.2 de la app)
    public tieneArtefactosCompletos(): boolean {
        return (
            this.formato === "tflite" &&
            this.artefactos.rutaEtiquetas !== null &&
            this.artefactos.rutaCalibracion !== null &&
            this.artefactos.firma !== null
        );
    }
}
