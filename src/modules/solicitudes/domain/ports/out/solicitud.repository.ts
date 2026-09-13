import { Solicitud, EstadoSolicitud } from "../../entities/solicitud.entity";

export interface ISolicitudRepository {
    findById(id: string): Promise<Solicitud | null>;
    findAll(filtros?: { estado?: EstadoSolicitud; agronomoId?: string }): Promise<Solicitud[]>;
    guardar(solicitud: Solicitud): Promise<void>;
}

// Token de inyección PARA dependencias de NestJS
export const SOLICITUD_REPOSITORY = "SOLICITUD_REPOSITORY";
