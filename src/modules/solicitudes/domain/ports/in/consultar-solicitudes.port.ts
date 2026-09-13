import { EstadoSolicitud, Solicitud } from "../../entities/solicitud.entity";

export interface FiltrosSolicitudQuery {
    estado?: EstadoSolicitud;
    agronomoId?: string;
}

export interface IlistarSolicitudUseCase {
    ejecutar(filtros?: FiltrosSolicitudQuery): Promise<Solicitud[]>;
}

export interface IObtenerSolicitudPorIdUseCase {
    ejecutar(id: string): Promise<Solicitud>;
}
