import { Solicitud, EstadoSolicitud } from "../../entities/solicitud.entity";
import type { AnexoResolucion } from "../../entities/anexo-resolucion.entity";

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
    // RF-04.6: los anexos se guardan en la misma transacción; si la resolución no pasa, tampoco ellos.
    guardarResolucion(solicitud: Solicitud, anexos?: AnexoResolucion[]): Promise<boolean>;
    // RF-08.3: persiste solo agronomo_id y estado si la fila sigue como se leyó.
    // Devuelve false si otra petición la cambió primero (asignación o resolución simultánea).
    guardarAsignacion(
        solicitud: Solicitud,
        anterior: { estado: EstadoSolicitud; agronomoId: string | null },
    ): Promise<boolean>;
}

// Token de inyección PARA dependencias de NestJS
export const SOLICITUD_REPOSITORY = "SOLICITUD_REPOSITORY";
