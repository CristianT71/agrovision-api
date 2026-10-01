import type { Canal, ModeloIa } from "../../entities/modelo-ia.entity";

export interface FiltrosModelo {
    canal?: Canal;
}

export interface IModeloIaRepository {
    findById(id: string): Promise<ModeloIa | null>;
    findByVersion(version: string): Promise<ModeloIa | null>;
    findAll(filtros?: FiltrosModelo): Promise<ModeloIa[]>;
    // Devuelve false si la versión ya existía (otra subida llegó primero)
    crear(modelo: ModeloIa): Promise<boolean>;
}

// Token de inyección PARA dependencias de NestJS
export const MODELO_IA_REPOSITORY = "MODELO_IA_REPOSITORY";
