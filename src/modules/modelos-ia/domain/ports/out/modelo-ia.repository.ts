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
    // RF-09.2: reemplaza todas las métricas del modelo
    guardarMetricas(modelo: ModeloIa): Promise<void>;
}

// Token de inyección PARA dependencias de NestJS
export const MODELO_IA_REPOSITORY = "MODELO_IA_REPOSITORY";
