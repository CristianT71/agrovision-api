import type { Deteccion } from "../../entities/deteccion.entity";

export interface DeteccionExistente {
    id: string;
    idCliente: string;
    productorId: string;
}

export interface IDeteccionRepository {
    // Las que ya llegaron en un envío anterior (la app reintenta cuando pierde la respuesta)
    findExistentes(idsCliente: string[]): Promise<DeteccionExistente[]>;
    // Inserta las nuevas y devuelve los idCliente que sí quedaron guardados: si otra petición
    // con el mismo id llegó primero, esa captura no aparece en la respuesta
    insertarNuevas(detecciones: Deteccion[]): Promise<Set<string>>;
}

// Token de inyección PARA dependencias de NestJS
export const DETECCION_REPOSITORY = "DETECCION_REPOSITORY";
