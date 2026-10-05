import { Inject, Injectable } from "@nestjs/common";
import type { IResumirTelemetriaUseCase, ResumenTelemetria } from "../../domain/ports/in/telemetria.port";
import { TELEMETRIA_REPOSITORY, type ITelemetriaRepository } from "../../domain/ports/out/telemetria.repository";
import {
    calcularIndicadores,
    calcularPuntoSerie,
    calcularTasaExito,
    resolverVentana,
} from "../../domain/services/indicadores";

// RF-06.2, RF-06.3 y RF-06.4: tasas por modelo, serie diaria y éxito de las actualizaciones
@Injectable()
export class ResumirTelemetriaService implements IResumirTelemetriaUseCase {
    constructor(
        @Inject(TELEMETRIA_REPOSITORY)
        private readonly repositorio: ITelemetriaRepository,
    ) {}

    async ejecutar(consulta: { desde?: Date; hasta?: Date }): Promise<ResumenTelemetria> {
        const ventana = resolverVentana(consulta.desde, consulta.hasta, new Date());

        const [modelos, actualizaciones, dias] = await Promise.all([
            this.repositorio.contarPorModelo(ventana),
            this.repositorio.contarActualizaciones(ventana),
            this.repositorio.contarPorDiaYModelo(ventana),
        ]);

        return {
            desde: ventana.desde,
            hasta: ventana.hasta,
            porModelo: modelos.map(calcularIndicadores),
            actualizaciones: actualizaciones.map(calcularTasaExito),
            serie: dias.map(calcularPuntoSerie),
        };
    }
}
