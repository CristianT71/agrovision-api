import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { IObtenerSolicitudPorIdUseCase } from "../../domain/ports/in/consultar-solicitudes.port";
import type { ISolicitudRepository } from "../../domain/ports/out/solicitud.repository";
import { SOLICITUD_REPOSITORY } from "../../domain/ports/out/solicitud.repository";
import type { Solicitud } from "../../domain/entities/solicitud.entity";

@Injectable()
export class ObtenerSolicitudPorIdService implements IObtenerSolicitudPorIdUseCase {
    constructor(
        @Inject(SOLICITUD_REPOSITORY)
        private readonly solicitudRepository: ISolicitudRepository,
    ) {}

    async ejecutar(id: string): Promise<Solicitud> {
        const solicitud = await this.solicitudRepository.findById(id);

        if (!solicitud) {
            throw new NotFoundException(`La solicitud con ID ${id} no fue encontrada.`);
        }
        return solicitud;
    }
}
