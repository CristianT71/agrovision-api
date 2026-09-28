import type { ContextoSolicitud } from "../../entities/permiso-contacto.entity";

// El permiso no administra solicitudes: solo consulta las que ya existen
export interface IConsultaSolicitudes {
    obtenerContexto(solicitudId: string): Promise<ContextoSolicitud | null>;
}

// Token de inyección PARA dependencias de NestJS
export const CONSULTA_SOLICITUDES = "CONSULTA_SOLICITUDES";
