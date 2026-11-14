import type { IAuditoriaReglasZona } from "./auditoria-reglas-zona.port";
import type { IReglasZonaEscritura } from "./reglas-zona.repository";

export const UNIDAD_TRABAJO_REGLAS_ZONA = "UNIDAD_TRABAJO_REGLAS_ZONA";

// Puertos ligados a una misma transacción.
export interface TransaccionReglasZona {
    reglas: IReglasZonaEscritura;
    auditoria: IAuditoriaReglasZona;
}

export interface IUnidadTrabajoReglasZona {
    // Todo lo que `trabajo` escribe (regla y auditoría) se confirma junto; si lanza, no queda nada.
    ejecutar<T>(trabajo: (tx: TransaccionReglasZona) => Promise<T>): Promise<T>;
}
