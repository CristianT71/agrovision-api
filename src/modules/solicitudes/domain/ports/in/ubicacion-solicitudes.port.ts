import type { EstadoSolicitud, Cultivo, OrigenAltitud } from "../../entities/solicitud.entity";

export const MAX_PUNTOS_MAPA = 500;

export interface UbicacionSolicitudVista {
    solicitudId: string;
    estado: EstadoSolicitud;
    fecha: Date;
    productorNombre: string | null;
    municipio: string;
    vereda: string;
    finca: string;
    latitud: number;
    longitud: number;
    precisionMetros: number | null;
    altitudMsnm: number | null;
    altitudOrigen: OrigenAltitud | null;
    // Ubicación que el sistema operativo marcó como simulada: el panel debe advertirlo
    simulada: boolean;
}

export interface FiltrosMapa {
    estado?: EstadoSolicitud;
    agronomoId?: string;
    cultivo?: Cultivo;
    municipio?: string;
    desde?: Date;
    hasta?: Date;
}

export interface PuntoMapa {
    solicitudId: string;
    estado: EstadoSolicitud;
    fecha: Date;
    productorNombre: string | null;
    municipio: string;
    vereda: string;
    finca: string;
    cultivo: Cultivo | null;
    latitud: number;
    longitud: number;
    altitudMsnm: number | null;
    simulada: boolean;
}

export interface MapaSolicitudes {
    puntos: PuntoMapa[];
    // true cuando había más casos que el límite: el panel debe pedir al administrador que afine los filtros
    truncado: boolean;
    limite: number;
}

type Usuario = { id: string; rol: string };

export interface IObtenerUbicacionSolicitudUseCase {
    // null cuando la solicitud no tiene ubicación
    ejecutar(usuario: Usuario, solicitudId: string): Promise<UbicacionSolicitudVista | null>;
    ejecutarKml(usuario: Usuario, solicitudId: string): Promise<{ nombreArchivo: string; kml: string }>;
}

export interface IListarMapaSolicitudesUseCase {
    ejecutar(usuario: Usuario, filtros: FiltrosMapa): Promise<MapaSolicitudes>;
    ejecutarKml(usuario: Usuario, filtros: FiltrosMapa): Promise<{ nombreArchivo: string; kml: string }>;
}
