import type { Solicitud } from "../../entities/solicitud.entity";
import type { AnexoResolucion } from "../../entities/anexo-resolucion.entity";
import type { FiltrosSolicitud } from "./solicitud.repository";
import type { ConteoBandeja } from "../../services/contadores-bandeja";
import type { VentanaTiempo } from "../../../../../common/utils/ventana-tiempo";

// Solicitud con los datos del productor que muestra el panel (la tabla solicitudes solo guarda su id)
export interface SolicitudConProductor {
    solicitud: Solicitud;
    productorNombre: string | null;
}

export interface FiltrosLecturaSolicitudes extends FiltrosSolicitud {
    // RF-03.5: texto libre sobre el nombre del productor, el predio o el código de la solicitud
    busqueda?: string;
    // RF-08.2: solo las "Enviada" sin agrónomo, las únicas que el administrador puede asignar
    sinAsignar?: boolean;
}

export interface PaginaLectura {
    numero: number;
    limite: number;
}

// Puerto de solo lectura para las bandejas y el detalle: no modifica solicitudes
export interface ILecturaSolicitudes {
    // Sin paginar: solo para otros módulos que necesitan todas las de un agrónomo
    listar(filtros: FiltrosLecturaSolicitudes): Promise<SolicitudConProductor[]>;
    // RNF-03.1: una página de la bandeja, ordenada por fecha DESC con el id como desempate
    listarPagina(
        filtros: FiltrosLecturaSolicitudes,
        pagina: PaginaLectura,
    ): Promise<{ total: number; resultados: SolicitudConProductor[] }>;
    // RF-03.4, RF-08.2: una sola consulta agregada por estado
    contarBandeja(filtros: { agronomoId?: string }): Promise<ConteoBandeja>;
    obtener(id: string): Promise<SolicitudConProductor | null>;
    // RF-04.3: casos ya resueltos (los más recientes) para compararlos con uno nuevo
    listarResueltas(excluirId: string, limite: number): Promise<SolicitudConProductor[]>;
    // RF-04.6: anexos que el agrónomo adjuntó a la resolución
    listarAnexos(solicitudId: string): Promise<AnexoResolucion[]>;
    obtenerAnexo(solicitudId: string, anexoId: string): Promise<AnexoResolucion | null>;

    // RF-06.5 a RF-06.7: tablero de resoluciones. Todo se mide sobre fecha_resolucion
    // de las solicitudes "Resuelta", en la ventana [desde, hasta)
    contarResueltasPorTipo(ventana: VentanaTiempo): Promise<{ tipo: string | null; casos: number }[]>;
    // Instantes de las "Plaga nueva": el corte por día en hora de Colombia lo hace el dominio
    fechasPlagaNueva(ventana: VentanaTiempo): Promise<Date[]>;
    listarPlagaNueva(ventana: VentanaTiempo, limite: number): Promise<SolicitudConProductor[]>;
    contarPlagaNuevaDesde(desde: Date): Promise<number>;
}

export const LECTURA_SOLICITUDES = "LECTURA_SOLICITUDES";
