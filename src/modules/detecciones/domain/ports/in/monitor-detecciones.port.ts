import type { Cultivo, Organo } from "../../../../solicitudes/domain/entities/solicitud.entity";
import type { Categoria, ResultadoCompuerta } from "../../services/categoria-biologica";
import type { EstadoRevision, OrigenRevision } from "../../services/divergencia";
import type { FiltrosDetecciones, ResumenCategoria } from "../out/lectura-detecciones.port";

// Lo que ve el panel. El embedding no se expone: es un vector para uso interno.
export interface DeteccionVista {
    id: string;
    idCliente: string;
    productorId: string;
    productorNombre: string | null;
    municipio: string;
    categoria: Categoria;
    clasePredicha: string | null;
    confianza: number | null;
    puntajeOod: number;
    resultadoCompuerta: ResultadoCompuerta;
    modeloId: string | null;
    modeloVersion: string;
    cultivo: Cultivo | null;
    organo: Organo | null;
    latitud: number | null;
    longitud: number | null;
    fecha: Date;
    recibidaEn: Date;
    // RF-07.4
    defectuosa: boolean;
    // RF-07.3
    revision: {
        estado: EstadoRevision;
        origen: OrigenRevision | null;
        correccionProductor: string | null;
        confirmadaProductor: boolean;
        solicitudId: string | null;
        resultadoAgronomo: string | null;
        plagaAgronomo: string | null;
    };
}

export interface PaginaDetecciones {
    datos: DeteccionVista[];
    total: number;
    pagina: number;
    limite: number;
}

export interface IListarDeteccionesUseCase {
    ejecutar(consulta: { filtros: FiltrosDetecciones; pagina: number; limite: number }): Promise<PaginaDetecciones>;
}

export interface IObtenerDeteccionUseCase {
    ejecutar(id: string): Promise<DeteccionVista>;
}

export interface ResumenDetecciones {
    total: number;
    divergentes: number;
    defectuosas: number;
    porCategoria: ResumenCategoria[];
}

export interface IResumirDeteccionesUseCase {
    ejecutar(filtros: FiltrosDetecciones): Promise<ResumenDetecciones>;
}
