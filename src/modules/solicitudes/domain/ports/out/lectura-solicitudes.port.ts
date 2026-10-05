import type { Solicitud } from "../../entities/solicitud.entity";
import type { AnexoResolucion } from "../../entities/anexo-resolucion.entity";
import type { FiltrosSolicitud } from "./solicitud.repository";

// Solicitud con los datos del productor que muestra el panel (la tabla solicitudes solo guarda su id)
export interface SolicitudConProductor {
    solicitud: Solicitud;
    productorNombre: string | null;
}

export interface FiltrosLecturaSolicitudes extends FiltrosSolicitud {
    // RF-03.5: texto libre sobre el nombre del productor, el predio o el código de la solicitud
    busqueda?: string;
}

// Puerto de solo lectura para las bandejas y el detalle: no modifica solicitudes
export interface ILecturaSolicitudes {
    listar(filtros: FiltrosLecturaSolicitudes): Promise<SolicitudConProductor[]>;
    obtener(id: string): Promise<SolicitudConProductor | null>;
    // RF-04.3: casos ya resueltos (los más recientes) para compararlos con uno nuevo
    listarResueltas(excluirId: string, limite: number): Promise<SolicitudConProductor[]>;
    // RF-04.6: anexos que el agrónomo adjuntó a la resolución
    listarAnexos(solicitudId: string): Promise<AnexoResolucion[]>;
    obtenerAnexo(solicitudId: string, anexoId: string): Promise<AnexoResolucion | null>;
}

export const LECTURA_SOLICITUDES = "LECTURA_SOLICITUDES";
