import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { IResolverSolicitudUseCase, ResolverSolicitudCommand } from "../../domain/ports/in/resolver-solicitud.port";
import type { ISolicitudRepository } from "../../domain/ports/out/solicitud.repository";
import { SOLICITUD_REPOSITORY } from "../../domain/ports/out/solicitud.repository";

@Injectable()
export class ResolverSolicitudService implements IResolverSolicitudUseCase {
    constructor(
        @Inject(SOLICITUD_REPOSITORY)
        private readonly solicitudRepository: ISolicitudRepository,
    ) {}

    async ejecutar(comando: ResolverSolicitudCommand): Promise<void> {
        const { solicitudId, respuestaProfesional, tipoResultado } = comando;

        // 1. Obtener la solicitud desde el puerto
        const solicitud = await this.solicitudRepository.findById(solicitudId);

        if (!solicitud) {
            throw new NotFoundException(`La solicitud con ID ${solicitudId} no existe.`);
        }

        // 2. Ejecutar la lógica de negocio pura del dominio (RF-04.8)
        solicitud.resolver(respuestaProfesional, tipoResultado);

        // 3. Persistir el cambio
        await this.solicitudRepository.guardar(solicitud);
    }
}
