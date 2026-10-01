import { ReglaNegocioError } from "../../../../common/errors/regla-negocio.error";
import type { MetricaModelo } from "./metrica-modelo.entity";
import { compararVersiones, leerVersion } from "../services/versiones";

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

// Orden del pipeline de liberación (RF-09.5). Descontinuado es el final y no tiene siguiente.
const SIGUIENTE_CANAL: Record<Canal, Canal | null> = {
    borrador: "interno",
    interno: "canario",
    canario: "produccion",
    produccion: null,
    descontinuado: null,
};

// El canario es una muestra: nunca la mitad o más de la flota
export const MIN_PORCENTAJE_CANARIO = 1;
export const MAX_PORCENTAJE_CANARIO = 50;

// RF-09.3: la justificación del kill-switch debe explicar la causa, no ser un "ok"
export const MIN_LONGITUD_JUSTIFICACION = 20;
export const MAX_LONGITUD_JUSTIFICACION = 1000;

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

    // Regla de Negocio (RF-09.3): interrupción forzada de una versión que ya está en dispositivos.
    // Exige una justificación documentada; los teléfonos vuelven a su modelo anterior sin descargar nada.
    public activarKillSwitch(justificacion: string): void {
        if (this.canal !== "canario" && this.canal !== "produccion") {
            throw new ReglaNegocioError("El kill-switch solo aplica a modelos publicados en canario o producción.");
        }

        if (this.killSwitch) {
            throw new ReglaNegocioError("El kill-switch de este modelo ya está activo.");
        }

        const motivo = justificacion?.trim() ?? "";
        if (motivo.length < MIN_LONGITUD_JUSTIFICACION) {
            throw new ReglaNegocioError(
                `La justificación del kill-switch debe tener al menos ${MIN_LONGITUD_JUSTIFICACION} caracteres.`,
            );
        }

        if (motivo.length > MAX_LONGITUD_JUSTIFICACION) {
            throw new ReglaNegocioError(
                `La justificación del kill-switch no puede superar ${MAX_LONGITUD_JUSTIFICACION} caracteres.`,
            );
        }

        this.killSwitch = true;
        this.motivoKillSwitch = motivo;
        this.fechaKillSwitch = new Date();
    }

    public metricaGlobal(): MetricaModelo | null {
        return this.metricas.find((metrica) => metrica.clase === null) ?? null;
    }

    // Regla de Negocio (RF-09.5): pipeline de liberación en orden estricto. Desde cualquier canal
    // se puede descontinuar; del canario se puede ajustar el porcentaje sin cambiar de canal.
    public cambiarCanal(destino: Canal, opciones: { porcentajeCanario?: number } = {}): void {
        if (this.canal === "descontinuado") {
            throw new ReglaNegocioError("Un modelo descontinuado no vuelve al pipeline: sube una versión nueva.");
        }

        if (destino === "descontinuado") {
            this.canal = "descontinuado";
            this.porcentajeCanario = null;
            return;
        }

        if (this.killSwitch) {
            throw new ReglaNegocioError("Un modelo con kill-switch activo solo puede descontinuarse.");
        }

        const ajusteDelCanario = this.canal === "canario" && destino === "canario";
        if (!ajusteDelCanario && SIGUIENTE_CANAL[this.canal] !== destino) {
            throw new ReglaNegocioError(
                `Desde ${this.canal} el modelo solo puede pasar a ${SIGUIENTE_CANAL[this.canal]} o descontinuarse.`,
            );
        }

        if (destino === "canario" || destino === "produccion") {
            this.validarPublicable();
        }

        if (destino === "canario") {
            const porcentaje = opciones.porcentajeCanario ?? Number.NaN;
            if (
                !Number.isInteger(porcentaje) ||
                porcentaje < MIN_PORCENTAJE_CANARIO ||
                porcentaje > MAX_PORCENTAJE_CANARIO
            ) {
                throw new ReglaNegocioError(
                    `El canario necesita un porcentaje entero entre ${MIN_PORCENTAJE_CANARIO} y ${MAX_PORCENTAJE_CANARIO}.`,
                );
            }
            this.porcentajeCanario = porcentaje;
        } else {
            this.porcentajeCanario = null;
        }

        this.canal = destino;
        this.fechaPublicacion ??= new Date();
    }

    // Regla de Negocio (RF-09.5): la app solo instala una versión MAYOR que la que ya tiene.
    // Publicar una igual o menor que la de producción no llegaría a ningún teléfono.
    public validarSucesorDe(vigente: ModeloIa | null): void {
        if (!vigente || vigente.id === this.id) return;

        const propia = leerVersion(this.version);
        const actual = leerVersion(vigente.version);
        if (propia && actual && compararVersiones(propia, actual) <= 0) {
            throw new ReglaNegocioError(
                `La versión ${this.version} debe ser mayor que la de producción (${vigente.version}) para que los teléfonos la instalen.`,
            );
        }
    }

    // Lo que exige la app para instalarlo, más las métricas que justifican publicarlo
    private validarPublicable(): void {
        if (this.formato !== "tflite") {
            throw new ReglaNegocioError("Solo un modelo .tflite puede llegar a los dispositivos.");
        }

        if (!this.artefactos.rutaEtiquetas || !this.artefactos.rutaCalibracion) {
            throw new ReglaNegocioError("El modelo necesita etiquetas y calibración para publicarse.");
        }

        if (!this.artefactos.firma) {
            throw new ReglaNegocioError(
                "El modelo no está firmado: configura MODEL_SIGNING_PRIVATE_KEY y vuelve a subir la versión.",
            );
        }

        if (!this.metricaGlobal()) {
            throw new ReglaNegocioError("Registra las métricas del modelo antes de publicarlo.");
        }
    }

    // Lo que ve un dispositivo: publicado en canario o producción y sin kill-switch
    public estaActivo(): boolean {
        return (this.canal === "canario" || this.canal === "produccion") && !this.killSwitch;
    }
}
