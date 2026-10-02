import { ReglaNegocioError } from "../../../../common/errors/regla-negocio.error";

// Eventos que dejan rastro en la vida de un modelo (RF-09.4)
export const ACCIONES_AUDITORIA = ["subida", "metricas", "cambio_canal", "kill_switch"] as const;
export type AccionAuditoria = (typeof ACCIONES_AUDITORIA)[number];

// Entrada inmutable del log de auditoría de modelos (RF-09.4, RNF-01.2): operador, estampa de tiempo
// y causa. Solo se crea; la base de datos rechaza cualquier UPDATE o DELETE sobre la tabla.
export class RegistroAuditoria {
    constructor(
        public readonly id: string,
        public readonly modeloId: string,
        public readonly accion: AccionAuditoria,
        // Cuenta de login (usuarios.id) del administrador que ejecutó la acción
        public readonly actorUsuarioId: string,
        public readonly motivo: string | null,
        public readonly detalle: Record<string, unknown> | null,
        public readonly fecha: Date,
    ) {}

    public static registrar(datos: {
        id: string;
        modeloId: string;
        accion: AccionAuditoria;
        actorUsuarioId: string;
        motivo?: string | null;
        detalle?: Record<string, unknown> | null;
    }): RegistroAuditoria {
        if (!datos.actorUsuarioId) {
            throw new ReglaNegocioError("Todo registro de auditoría necesita al operador que ejecutó la acción.");
        }

        return new RegistroAuditoria(
            datos.id,
            datos.modeloId,
            datos.accion,
            datos.actorUsuarioId,
            datos.motivo?.trim() || null,
            datos.detalle ?? null,
            new Date(),
        );
    }
}
