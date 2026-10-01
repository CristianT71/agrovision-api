import { ReglaNegocioError } from "../../../../common/errors/regla-negocio.error";

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
