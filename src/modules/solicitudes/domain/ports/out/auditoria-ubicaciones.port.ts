// Consultas de ubicación exacta que dejan rastro (RNF-01.2)
export const ACCIONES_AUDITORIA_UBICACION = ["ubicacion_detalle", "ubicacion_kml", "mapa_listado", "mapa_kml"] as const;
export type AccionAuditoriaUbicacion = (typeof ACCIONES_AUDITORIA_UBICACION)[number];

export interface RegistroConsultaUbicacion {
    accion: AccionAuditoriaUbicacion;
    // Cuenta de login (usuarios.id) de quien consultó
    actorUsuarioId: string;
    // Solicitud consultada; null en las consultas del mapa, que abarcan varias
    solicitudId: string | null;
    // Filtros del mapa tal como se aplicaron
    filtros: Record<string, unknown> | null;
    // Cuántos puntos devolvió el mapa
    resultados: number | null;
}

// Registro de solo inserción: quién vio dónde está un cultivo, cuál y cuándo
export interface IAuditoriaUbicaciones {
    registrar(registro: RegistroConsultaUbicacion): Promise<void>;
}

export const AUDITORIA_UBICACIONES = "AUDITORIA_UBICACIONES";
