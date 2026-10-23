import type { Deteccion } from "../../entities/deteccion.entity";

export interface DeteccionExistente {
    id: string;
    idCliente: string;
    productorId: string;
}

export interface RevisionProductor {
    idCliente: string;
    correccionProductor: string | null;
    confirmadaProductor: boolean;
}

export interface IDeteccionRepository {
    // Las que ya llegaron en un envío anterior (la app reintenta cuando pierde la respuesta)
    findExistentes(idsCliente: string[]): Promise<DeteccionExistente[]>;
    // Inserta las nuevas y devuelve los idCliente que sí quedaron guardados: si otra petición
    // con el mismo id llegó primero, esa captura no aparece en la respuesta
    insertarNuevas(detecciones: Deteccion[]): Promise<Set<string>>;
    // El productor puede corregir o confirmar la lectura después de haberla enviado: la app reenvía la
    // captura y el servidor la actualiza. Solo toca las de ese productor.
    actualizarRevision(productorId: string, revisiones: RevisionProductor[]): Promise<void>;
}

// Token de inyección PARA dependencias de NestJS
export const DETECCION_REPOSITORY = "DETECCION_REPOSITORY";
