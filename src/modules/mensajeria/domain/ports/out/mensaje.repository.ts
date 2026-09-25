import type { AutorTipo, Mensaje } from "../../entities/mensaje.entity";

// Pendientes por solicitud para un lector concreto (RF-08.6)
export interface PendientesPorSolicitud {
    solicitudId: string;
    pendientes: number;
}

export interface IMensajeRepository {
    guardar(mensaje: Mensaje): Promise<Mensaje>;
    findById(id: string): Promise<Mensaje | null>;
    // Bitácora completa en orden cronológico, con sus adjuntos (RF-04.9)
    listarPorSolicitud(solicitudId: string): Promise<Mensaje[]>;
    // Marca los mensajes de la contraparte y devuelve cuántos cambiaron
    marcarLeidos(solicitudId: string, lector: AutorTipo): Promise<number>;
    // Sin solicitudIds cuenta en todas las solicitudes; con un arreglo vacío no hay nada que contar
    contarPendientes(lector: AutorTipo, solicitudIds?: string[]): Promise<PendientesPorSolicitud[]>;
}

// Token de inyección PARA dependencias de NestJS
export const MENSAJE_REPOSITORY = "MENSAJE_REPOSITORY";
