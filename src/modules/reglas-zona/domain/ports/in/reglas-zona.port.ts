import type { FilaRegla, VistaReglaZona } from "../../entities/regla-zona";
import type { FiltrosReglasZona } from "../out/reglas-zona.repository";

export const GESTION_REGLAS_ZONA = "GESTION_REGLAS_ZONA";
export const REGLAS_ZONA_PUBLICAS = "REGLAS_ZONA_PUBLICAS";

export interface Actor {
    id: string;
    rol: string;
}

export interface ResultadoSimulacion {
    reglaVersion: number;
    filaAplicada: number;
    radioMinM: number;
    radioMaxM: number;
    plantasMin: number;
    plantasMax: number;
    calibrada: boolean;
}

export interface IGestionReglasZona {
    crear(
        actor: Actor,
        datos: { tipoEnfermedad: string; notas: string | null; filas: FilaRegla[] },
    ): Promise<VistaReglaZona>;
    listar(filtros: FiltrosReglasZona): Promise<VistaReglaZona[]>;
    obtener(id: string): Promise<VistaReglaZona>;
    editar(actor: Actor, id: string, cambios: { notas?: string | null; filas?: FilaRegla[] }): Promise<VistaReglaZona>;
    eliminar(actor: Actor, id: string): Promise<void>;
    duplicar(actor: Actor, id: string): Promise<VistaReglaZona>;
    aprobar(actor: Actor, id: string, datos: { calibrada: boolean; nota?: string | null }): Promise<VistaReglaZona>;
    activar(actor: Actor, id: string): Promise<VistaReglaZona>;
    archivar(actor: Actor, id: string): Promise<VistaReglaZona>;
    simular(
        id: string,
        datos: { severidadPct: number; incidenciaPct: number; plantasPorHa: number },
    ): Promise<ResultadoSimulacion>;
}

// Regla activa para la app: sin ids internos ni datos del agrónomo.
export interface ReglaZonaPublica {
    tipoEnfermedad: string;
    version: number;
    calibrada: boolean;
    filas: FilaRegla[];
}

export interface IReglasZonaPublicas {
    obtenerActiva(tipoEnfermedad: string): Promise<{ regla: ReglaZonaPublica; etag: string } | null>;
}
