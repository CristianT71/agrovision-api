import type { ConteoActualizacion, IndicadoresModelo } from "../../services/indicadores";

export interface IRegistrarEventoUseCase {
    ejecutar(mapa: Record<string, unknown>): Promise<void>;
}

export interface ResumenTelemetria {
    desde: Date;
    hasta: Date;
    porModelo: IndicadoresModelo[];
    actualizaciones: (ConteoActualizacion & { tasaExito: number | null })[];
}

export interface IResumirTelemetriaUseCase {
    ejecutar(consulta: { desde?: Date; hasta?: Date }): Promise<ResumenTelemetria>;
}
