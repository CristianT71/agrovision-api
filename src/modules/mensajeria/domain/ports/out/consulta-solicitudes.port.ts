import type { ContextoSolicitud } from "../../services/canal-coordinacion";

// El canal no administra solicitudes: solo consulta las que ya existen
export interface IConsultaSolicitudes {
    obtenerContexto(solicitudId: string): Promise<ContextoSolicitud | null>;
    listarIdsAsignadas(agronomoId: string): Promise<string[]>;
}

// Token de inyección PARA dependencias de NestJS
export const CONSULTA_SOLICITUDES = "CONSULTA_SOLICITUDES";
