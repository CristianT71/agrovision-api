import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { IResolverSolicitudUseCase, ResolverSolicitudCommand } from "../../domain/ports/in/resolver-solicitud.port";
import type { ISolicitudRepository } from "../../domain/ports/out/solicitud.repository";
import { SOLICITUD_REPOSITORY } from "../../domain/ports/out/solicitud.repository";
import { AGRONOMO_REPOSITORY, type IAgronomoRepository } from "../../../agronomos/domain/ports/out/agronomo.repository";

@Injectable()
export class ResolverSolicitudService implements IResolverSolicitudUseCase {
    constructor(
        @Inject(SOLICITUD_REPOSITORY)
        private readonly solicitudRepository: ISolicitudRepository,
        @Inject(AGRONOMO_REPOSITORY)
        private readonly agronomoRepository: IAgronomoRepository,
    ) {}

    async ejecutar(comando: ResolverSolicitudCommand): Promise<void> {
        const { solicitudId, usuarioId, respuestaProfesional, tipoResultado, plagaIdentificada } = comando;

        // 1. Obtener la solicitud desde el puerto
        const solicitud = await this.solicitudRepository.findById(solicitudId);

        if (!solicitud) {
            throw new NotFoundException(`La solicitud con ID ${solicitudId} no existe.`);
        }

        // 2. Solo el agrónomo activo al que se delegó el caso puede resolverlo (RF-03.3, RF-08.3)
        const agronomo = await this.agronomoRepository.findByUsuarioId(usuarioId);
        if (!agronomo || !agronomo.puedeRecibirCasos()) {
            throw new ForbiddenException("Tu cuenta de agrónomo no está habilitada para resolver solicitudes.");
        }

        if (!solicitud.estaAsignadaA(agronomo.id)) {
            throw new ForbiddenException("Solo el agrónomo asignado puede resolver esta solicitud.");
        }

        // 3. Ejecutar la lógica de negocio pura del dominio (RF-04.5, RF-04.8)
        solicitud.resolver({ respuestaProfesional, tipoResultado, plagaIdentificada });

        // 4. Persistir el cambio sin pisar una resolución que haya llegado primero
        const guardada = await this.solicitudRepository.guardarResolucion(solicitud);
        if (!guardada) {
            throw new ConflictException("La solicitud cambió mientras se resolvía. Recarga para ver su estado.");
        }
    }
}
