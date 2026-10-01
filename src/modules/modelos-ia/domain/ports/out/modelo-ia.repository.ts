import type { Canal, ModeloIa } from "../../entities/modelo-ia.entity";
import type { RegistroAuditoria } from "../../entities/registro-auditoria.entity";

export interface FiltrosModelo {
    canal?: Canal;
}

// Cada escritura sobre un modelo viaja con su registro de auditoría y se guardan en la misma
// transacción (RF-09.4): no puede existir un cambio sin rastro ni un rastro sin cambio.
export interface IModeloIaRepository {
    findById(id: string): Promise<ModeloIa | null>;
    findByVersion(version: string): Promise<ModeloIa | null>;
    findAll(filtros?: FiltrosModelo): Promise<ModeloIa[]>;
    // Devuelve false si la versión ya existía (otra subida llegó primero)
    crear(modelo: ModeloIa, auditoria: RegistroAuditoria): Promise<boolean>;
    // RF-09.2: reemplaza todas las métricas del modelo
    guardarMetricas(modelo: ModeloIa, auditoria: RegistroAuditoria): Promise<void>;
    // Guarda en orden (los retirados primero). Devuelve false si chocó con otro canario o
    // producción vigente: otro administrador cambió el pipeline al mismo tiempo.
    guardarCambios(modelos: ModeloIa[], auditorias: RegistroAuditoria[]): Promise<boolean>;
    listarAuditoria(modeloId: string): Promise<RegistroAuditoria[]>;
}

// Token de inyección PARA dependencias de NestJS
export const MODELO_IA_REPOSITORY = "MODELO_IA_REPOSITORY";
