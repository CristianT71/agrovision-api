import type { EventoTelemetria } from "../../entities/evento-telemetria.entity";
import type { ConteoActualizacion, ConteoDiaModelo, ConteoModelo, VentanaTiempo } from "../../services/indicadores";

export interface ITelemetriaRepository {
    guardar(evento: EventoTelemetria): Promise<void>;
    contarPorModelo(ventana: VentanaTiempo): Promise<ConteoModelo[]>;
    // RF-06.3: mismos conteos que contarPorModelo, por día en America/Bogota y versión
    contarPorDiaYModelo(ventana: VentanaTiempo): Promise<ConteoDiaModelo[]>;
    contarActualizaciones(ventana: VentanaTiempo): Promise<ConteoActualizacion[]>;
}

// Token de inyección PARA dependencias de NestJS
export const TELEMETRIA_REPOSITORY = "TELEMETRIA_REPOSITORY";
