import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";
import type { IRegistrarEventoUseCase } from "../../domain/ports/in/telemetria.port";
import { TELEMETRIA_REPOSITORY, type ITelemetriaRepository } from "../../domain/ports/out/telemetria.repository";
import { EventoTelemetria } from "../../domain/entities/evento-telemetria.entity";
import { ReglaNegocioError } from "../../../../common/errors/regla-negocio.error";

@Injectable()
export class RegistrarEventoService implements IRegistrarEventoUseCase {
    constructor(
        @Inject(TELEMETRIA_REPOSITORY)
        private readonly repositorio: ITelemetriaRepository,
    ) {}

    async ejecutar(mapa: Record<string, unknown>): Promise<void> {
        let evento: EventoTelemetria;
        try {
            evento = EventoTelemetria.desdeMapa(uuidv4(), mapa, new Date());
        } catch (error) {
            // Un evento mal formado es un error del cliente (400), no un conflicto de negocio
            if (error instanceof ReglaNegocioError) throw new BadRequestException(error.message);
            throw error;
        }

        await this.repositorio.guardar(evento);
    }
}
