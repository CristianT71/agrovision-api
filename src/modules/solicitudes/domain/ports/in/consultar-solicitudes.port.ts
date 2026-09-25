import type { Solicitud, EstadoSolicitud } from "../../entities/solicitud.entity";

export interface ListarSolicitudesQuery {
    estado?: EstadoSolicitud;
    agronomoId?: string;
    // RF-03.3: solo los expedientes delegados al usuario actual
    soloMias?: boolean;
    usuario: { id: string; rol: string };
}

export interface IListarSolicitudesUseCase {
    ejecutar(consulta: ListarSolicitudesQuery): Promise<Solicitud[]>;
}

export interface IObtenerSolicitudPorIdUseCase {
    ejecutar(id: string): Promise<Solicitud>;
}
