import type { Solicitud, EstadoSolicitud } from "../../entities/solicitud.entity";

export interface FiltrosSolicitudQuery {
    estado?: EstadoSolicitud;
    agronomoId?: string;
}

export interface IListarSolicitudesUseCase {
    ejecutar(filtros?: FiltrosSolicitudQuery): Promise<Solicitud[]>;
}

export interface IObtenerSolicitudPorIdUseCase {
    ejecutar(id: string): Promise<Solicitud>;
}
