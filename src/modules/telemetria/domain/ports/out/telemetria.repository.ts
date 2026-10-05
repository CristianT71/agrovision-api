import type { EventoTelemetria } from "../../entities/evento-telemetria.entity";
import type { ConteoActualizacion, ConteoModelo, VentanaTiempo } from "../../services/indicadores";

export interface ITelemetriaRepository {
    guardar(evento: EventoTelemetria): Promise<void>;
    contarPorModelo(ventana: VentanaTiempo): Promise<ConteoModelo[]>;
    contarActualizaciones(ventana: VentanaTiempo): Promise<ConteoActualizacion[]>;
}

// Token de inyección PARA dependencias de NestJS
export const TELEMETRIA_REPOSITORY = "TELEMETRIA_REPOSITORY";
