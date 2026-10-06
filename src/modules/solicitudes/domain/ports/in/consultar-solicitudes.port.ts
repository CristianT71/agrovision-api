import type { Solicitud, EstadoSolicitud } from "../../entities/solicitud.entity";
import type { ContadoresBandeja } from "../../services/contadores-bandeja";

// RNF-03.1: la bandeja se pagina en el servidor
export const PAGINA_POR_DEFECTO = 1;
export const LIMITE_POR_DEFECTO = 20;
export const MAX_LIMITE = 100;

export interface ListarSolicitudesQuery {
    estado?: EstadoSolicitud;
    // Solo administrador: al agrónomo se le ignoran agronomoId y sinAsignar
    agronomoId?: string;
    sinAsignar?: boolean;
    // RF-03.5: nombre del productor, predio o código de la solicitud
    busqueda?: string;
    pagina?: number;
    limite?: number;
    usuario: { id: string; rol: string };
}

// Lo que ve el panel: la solicitud con el nombre de su productor
export type SolicitudVista = Solicitud & { productorNombre: string | null };

// Misma forma que /detecciones
export interface PaginaSolicitudes {
    datos: SolicitudVista[];
    total: number;
    pagina: number;
    limite: number;
}

export interface IListarSolicitudesUseCase {
    ejecutar(consulta: ListarSolicitudesQuery): Promise<PaginaSolicitudes>;
}

export interface IObtenerSolicitudPorIdUseCase {
    // El agrónomo solo puede ver las que tiene asignadas
    ejecutar(usuario: { id: string; rol: string }, id: string): Promise<SolicitudVista>;
}

// RF-03.4, RF-08.2: el agrónomo solo cuenta lo suyo
export interface IContarSolicitudesUseCase {
    ejecutar(usuario: { id: string; rol: string }): Promise<ContadoresBandeja>;
}
