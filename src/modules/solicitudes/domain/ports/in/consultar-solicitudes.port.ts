import type { Solicitud, EstadoSolicitud } from "../../entities/solicitud.entity";

export interface ListarSolicitudesQuery {
    estado?: EstadoSolicitud;
    agronomoId?: string;
    // RF-03.3: solo los expedientes delegados al usuario actual
    soloMias?: boolean;
    // RF-03.5: nombre del productor, predio o código de la solicitud
    busqueda?: string;
    usuario: { id: string; rol: string };
}

// Lo que ve el panel: la solicitud con el nombre de su productor
export type SolicitudVista = Solicitud & { productorNombre: string | null };

export interface IListarSolicitudesUseCase {
    ejecutar(consulta: ListarSolicitudesQuery): Promise<SolicitudVista[]>;
}

export interface IObtenerSolicitudPorIdUseCase {
    ejecutar(id: string): Promise<SolicitudVista>;
}
