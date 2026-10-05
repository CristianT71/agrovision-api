import { Inject, Injectable } from "@nestjs/common";
import type { IResumirTelemetriaUseCase, ResumenTelemetria } from "../../domain/ports/in/telemetria.port";
import { TELEMETRIA_REPOSITORY, type ITelemetriaRepository } from "../../domain/ports/out/telemetria.repository";
import { calcularIndicadores, calcularTasaExito, resolverVentana } from "../../domain/services/indicadores";

// RF-06.2 y RF-06.4: tasa de no reconocimiento, tasa de corrección y éxito de las actualizaciones
@Injectable()
export class ResumirTelemetriaService implements IResumirTelemetriaUseCase {
    constructor(
        @Inject(TELEMETRIA_REPOSITORY)
        private readonly repositorio: ITelemetriaRepository,
    ) {}

    async ejecutar(consulta: { desde?: Date; hasta?: Date }): Promise<ResumenTelemetria> {
        const ventana = resolverVentana(consulta.desde, consulta.hasta, new Date());

        const [modelos, actualizaciones] = await Promise.all([
            this.repositorio.contarPorModelo(ventana),
            this.repositorio.contarActualizaciones(ventana),
        ]);

        return {
            desde: ventana.desde,
            hasta: ventana.hasta,
            porModelo: modelos.map(calcularIndicadores),
            actualizaciones: actualizaciones.map(calcularTasaExito),
        };
    }
}
