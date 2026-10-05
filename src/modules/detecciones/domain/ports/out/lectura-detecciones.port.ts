import type { Deteccion } from "../../entities/deteccion.entity";
import type { Categoria } from "../../services/categoria-biologica";
import type { EstadoRevision } from "../../services/divergencia";

// RF-07.2: incluir agrupa con OR; excluir quita con AND NOT. Se combinan con los demás filtros.
export interface FiltrosDetecciones {
    incluir?: Categoria[];
    excluir?: Categoria[];
    revision?: EstadoRevision;
    defectuosas?: boolean;
    modeloVersion?: string;
    municipio?: string;
    desde?: Date;
    hasta?: Date;
}

// La detección con lo que dijo el agrónomo si de esa captura salió una solicitud resuelta
export interface DeteccionLeida {
    deteccion: Deteccion;
    productorNombre: string | null;
    solicitudId: string | null;
    resultadoAgronomo: string | null;
    plagaAgronomo: string | null;
}

export interface ResumenCategoria {
    categoria: Categoria;
    total: number;
    divergentes: number;
    defectuosas: number;
}

// Puerto de solo lectura para el monitor: no modifica detecciones
export interface ILecturaDetecciones {
    listar(
        filtros: FiltrosDetecciones,
        pagina: { numero: number; limite: number },
    ): Promise<{ total: number; filas: DeteccionLeida[] }>;
    obtener(id: string): Promise<DeteccionLeida | null>;
    resumir(filtros: FiltrosDetecciones): Promise<ResumenCategoria[]>;
}

export const LECTURA_DETECCIONES = "LECTURA_DETECCIONES";
