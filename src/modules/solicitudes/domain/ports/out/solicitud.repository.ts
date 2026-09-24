import { Solicitud, EstadoSolicitud } from "../../entities/solicitud.entity";

export interface FiltrosSolicitud {
    estado?: EstadoSolicitud;
    agronomoId?: string;
}

export interface ISolicitudRepository {
    findById(id: string): Promise<Solicitud | null>;
    findAll(filtros?: FiltrosSolicitud): Promise<Solicitud[]>;
    guardar(solicitud: Solicitud): Promise<void>;
    // RF-04.8: persiste la resolución solo si la solicitud sigue asignada al mismo agrónomo.
    // Devuelve false si otra petición la cambió primero (dos resoluciones simultáneas).
    guardarResolucion(solicitud: Solicitud): Promise<boolean>;
}

// Token de inyección PARA dependencias de NestJS
export const SOLICITUD_REPOSITORY = "SOLICITUD_REPOSITORY";
