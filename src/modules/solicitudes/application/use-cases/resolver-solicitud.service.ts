import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Inject,
    Injectable,
    NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { IResolverSolicitudUseCase, ResolverSolicitudCommand } from "../../domain/ports/in/resolver-solicitud.port";
import type { ISolicitudRepository } from "../../domain/ports/out/solicitud.repository";
import { SOLICITUD_REPOSITORY } from "../../domain/ports/out/solicitud.repository";
import { AGRONOMO_REPOSITORY, type IAgronomoRepository } from "../../../agronomos/domain/ports/out/agronomo.repository";
import {
    ALMACENAMIENTO_ARCHIVOS,
    type IAlmacenamientoArchivos,
} from "../../../../common/almacenamiento/almacenamiento.port";
import { AnexoResolucion, MAX_ANEXOS_RESOLUCION } from "../../domain/entities/anexo-resolucion.entity";

@Injectable()
export class ResolverSolicitudService implements IResolverSolicitudUseCase {
    constructor(
        @Inject(SOLICITUD_REPOSITORY)
        private readonly solicitudRepository: ISolicitudRepository,
        @Inject(AGRONOMO_REPOSITORY)
        private readonly agronomoRepository: IAgronomoRepository,
        @Inject(ALMACENAMIENTO_ARCHIVOS)
        private readonly almacenamiento: IAlmacenamientoArchivos,
    ) {}

    async ejecutar(comando: ResolverSolicitudCommand): Promise<void> {
        const { solicitudId, usuarioId, respuestaProfesional, tipoResultado, plagaIdentificada } = comando;
        const archivos = comando.anexos ?? [];

        if (archivos.length > MAX_ANEXOS_RESOLUCION) {
            throw new BadRequestException(`Puedes adjuntar máximo ${MAX_ANEXOS_RESOLUCION} anexos a la resolución.`);
        }

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

        // 4. RF-04.6: custodiar los anexos en almacenamiento privado antes de confirmar
        const anexos: AnexoResolucion[] = [];
        let guardada = false;
        try {
            for (const archivo of archivos) {
                const ruta = await this.almacenamiento.guardarPrivado(`solicitudes/${solicitud.id}/anexos`, archivo);
                anexos.push(
                    new AnexoResolucion(
                        randomUUID(),
                        solicitud.id,
                        ruta,
                        archivo.nombreOriginal,
                        archivo.tipoMime,
                        archivo.contenido.length,
                        new Date(),
                    ),
                );
            }

            // 5. Persistir resolución y anexos juntos, sin pisar una resolución que haya llegado primero
            guardada = await this.solicitudRepository.guardarResolucion(solicitud, anexos);
        } finally {
            // Si no quedó guardada (conflicto o error), no deben quedar archivos huérfanos
            if (!guardada) {
                await Promise.all(anexos.map((anexo) => this.almacenamiento.eliminarPrivado(anexo.ruta)));
            }
        }

        if (!guardada) {
            throw new ConflictException("La solicitud cambió mientras se resolvía. Recarga para ver su estado.");
        }
    }
}
