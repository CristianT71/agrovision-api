export const AUDITORIA_VUELOS = "AUDITORIA_VUELOS";
export interface RegistroAuditoriaVuelo {
    accion: "vuelo_creado" | "vuelo_borrado" | "enlace_emitido";
    actorUsuarioId: string;
    vueloId: string;
    archivoId?: string;
}
export interface IAuditoriaVuelos {
    registrar(registro: RegistroAuditoriaVuelo): Promise<void>;
}
