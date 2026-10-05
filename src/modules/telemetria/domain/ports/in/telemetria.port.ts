import type { ConteoActualizacion, IndicadoresModelo, PuntoSerie } from "../../services/indicadores";

export interface IRegistrarEventoUseCase {
    ejecutar(mapa: Record<string, unknown>): Promise<void>;
}

export interface ResumenTelemetria {
    desde: Date;
    hasta: Date;
    porModelo: IndicadoresModelo[];
    actualizaciones: (ConteoActualizacion & { tasaExito: number | null })[];
    // RF-06.3: una fila por día y versión, ordenada por día
    serie: PuntoSerie[];
}

export interface IResumirTelemetriaUseCase {
    ejecutar(consulta: { desde?: Date; hasta?: Date }): Promise<ResumenTelemetria>;
}
