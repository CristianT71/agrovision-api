export const AUDITORIA_REGLAS_ZONA = "AUDITORIA_REGLAS_ZONA";

export type AccionAuditoriaReglaZona = "crear" | "editar" | "borrar" | "duplicar" | "aprobar" | "activar" | "archivar";

// Solo identificadores y metadatos de la versión: nunca nombre, tarjeta profesional ni notas.
export interface RegistroAuditoriaReglaZona {
    accion: AccionAuditoriaReglaZona;
    actorUsuarioId: string;
    reglaId: string;
    detalle: {
        tipoEnfermedad: string;
        version: number;
        estado: string;
        calibrada?: boolean;
        origenId?: string;
        archivadaId?: string | null;
    };
}

export interface IAuditoriaReglasZona {
    registrar(registro: RegistroAuditoriaReglaZona): Promise<void>;
}
