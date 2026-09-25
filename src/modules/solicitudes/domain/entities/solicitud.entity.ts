import { ReglaNegocioError } from "../../../../common/errors/regla-negocio.error";

// Estados del ciclo de vida de una solicitud (RF-03.2)
export const ESTADOS_SOLICITUD = ["Pendiente", "Enviada", "Asignada", "Resuelta", "Descartada"] as const;
export type EstadoSolicitud = (typeof ESTADOS_SOLICITUD)[number];

// Categorización de la evaluación humana (RF-04.5)
export const TIPOS_RESULTADO = [
    "Confirma diagnóstico IA",
    "Corrige diagnóstico IA",
    "Plaga nueva",
    "Imagen no diagnosticable",
    "Planta sana",
] as const;
export type TipoResultado = (typeof TIPOS_RESULTADO)[number];

export class Solicitud {
    constructor(
        public readonly id: string,
        public readonly productorId: string,
        public agronomoId: string | null,
        public estado: EstadoSolicitud,
        public readonly fecha: Date,
        public readonly municipio: string,
        public readonly vereda: string,
        public readonly finca: string,
        public readonly confianzaIa: number,
        public readonly modeloVersionId: string,
        public respuestaProfesional: string | null = null,
        public tipoResultado: TipoResultado | null = null,
        public plagaIdentificada: string | null = null,
        public fechaResolucion: Date | null = null,
    ) {}

    public estaAsignadaA(agronomoId: string): boolean {
        return this.agronomoId === agronomoId;
    }

    // Regla de Negocio (RF-04.5, RF-04.7, RF-04.8): solo una solicitud asignada se resuelve,
    // con la evaluación completa, y queda en solo lectura
    public resolver(datos: {
        respuestaProfesional: string;
        tipoResultado: TipoResultado;
        plagaIdentificada: string;
    }): void {
        if (this.estado === "Resuelta") {
            throw new ReglaNegocioError("La solicitud ya se encuentra resuelta y es de solo lectura.");
        }

        if (this.estado === "Descartada") {
            throw new ReglaNegocioError("No se puede resolver una solicitud descartada.");
        }

        if (this.estado !== "Asignada" || !this.agronomoId) {
            throw new ReglaNegocioError("Solo se puede resolver una solicitud asignada a un agrónomo.");
        }

        if (!datos.respuestaProfesional?.trim() || !datos.plagaIdentificada?.trim() || !datos.tipoResultado) {
            throw new ReglaNegocioError(
                "La resolución exige tipo de resultado, plaga identificada y respuesta para el productor.",
            );
        }

        this.respuestaProfesional = datos.respuestaProfesional.trim();
        this.tipoResultado = datos.tipoResultado;
        this.plagaIdentificada = datos.plagaIdentificada.trim();
        this.fechaResolucion = new Date();
        this.estado = "Resuelta";
    }

    // Regla de Negocio (RF-08.3): Delegar o asignar recurso profesional
    public asignarAgronomo(agronomoId: string): void {
        if (this.estado === "Resuelta") {
            throw new ReglaNegocioError("No se puede reasignar una solicitud que ya fue resuelta.");
        }

        if (this.estado === "Descartada") {
            throw new ReglaNegocioError("No se puede asignar una solicitud descartada.");
        }

        if (this.estado === "Pendiente") {
            throw new ReglaNegocioError("No se puede asignar una solicitud que el productor aún no ha enviado.");
        }

        if (this.agronomoId === agronomoId) {
            throw new ReglaNegocioError("La solicitud ya está asignada a este agrónomo.");
        }

        this.agronomoId = agronomoId;
        this.estado = "Asignada";
    }
}
