import { ConflictException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { AsignarSolicitudCommand, IAsignarSolicitudUseCase } from "../../domain/ports/in/asignar-solicitud.port";
import type { ISolicitudRepository } from "../../domain/ports/out/solicitud.repository";
import { SOLICITUD_REPOSITORY } from "../../domain/ports/out/solicitud.repository";
import type { INotificadorSolicitudes } from "../../domain/ports/out/notificador-solicitudes.port";
import { NOTIFICADOR_SOLICITUDES } from "../../domain/ports/out/notificador-solicitudes.port";
import { AGRONOMO_REPOSITORY, type IAgronomoRepository } from "../../../agronomos/domain/ports/out/agronomo.repository";
import { POLITICA_ASIGNACION, type IPoliticaAsignacion } from "../../domain/ports/out/politica-asignacion.port";
import { Solicitud } from "../../domain/entities/solicitud.entity";
import { ReglaNegocioError } from "../../../../common/errors/regla-negocio.error";

@Injectable()
export class AsignarSolicitudService implements IAsignarSolicitudUseCase {
    private readonly logger = new Logger(AsignarSolicitudService.name);

    constructor(
        @Inject(SOLICITUD_REPOSITORY)
        private readonly solicitudRepository: ISolicitudRepository,
        @Inject(AGRONOMO_REPOSITORY)
        private readonly agronomoRepository: IAgronomoRepository,
        @Inject(NOTIFICADOR_SOLICITUDES)
        private readonly notificador: INotificadorSolicitudes,
        @Inject(POLITICA_ASIGNACION)
        private readonly politica: IPoliticaAsignacion,
    ) {}

    async ejecutar(comando: AsignarSolicitudCommand): Promise<Solicitud> {
        const { solicitudId, agronomoId } = comando;

        // 1. Obtener la solicitud desde el puerto
        const solicitud = await this.solicitudRepository.findById(solicitudId);

        if (!solicitud) {
            throw new NotFoundException(`La solicitud con ID ${solicitudId} no existe.`);
        }

        // 2. Solo se delegan casos a agrónomos activos (RF-08.3)
        const agronomo = await this.agronomoRepository.findById(agronomoId);

        if (!agronomo) {
            throw new NotFoundException(`El agrónomo con ID ${agronomoId} no existe.`);
        }

        if (!agronomo.puedeRecibirCasos()) {
            throw new ReglaNegocioError("Solo se pueden asignar casos a agrónomos activos.");
        }

        // 3. RF-08.4: pasar de la carga máxima se permite, pero solo si el administrador lo confirma
        if (!comando.confirmarSobrecarga) {
            const { cargaMaxima } = await this.politica.obtener();
            if (cargaMaxima !== null) {
                const casos = (await this.agronomoRepository.contarCasosActivos([agronomo.id])).get(agronomo.id) ?? 0;
                if (casos + 1 > cargaMaxima) {
                    throw new ReglaNegocioError(
                        `${agronomo.nombre} ya tiene ${casos} ${casos === 1 ? "caso" : "casos"} en curso y el máximo es ${cargaMaxima}. Confirma para asignarlo de todos modos.`,
                    );
                }
            }
        }

        // 4. Recordar cómo estaba antes de cambiarla: es la condición del UPDATE
        const anterior = { estado: solicitud.estado, agronomoId: solicitud.agronomoId };

        // 5. Ejecutar la lógica de negocio pura del dominio (RF-08.3)
        solicitud.asignarAgronomo(agronomo.id);

        // 6. Persistir sin pisar un cambio que haya llegado primero
        const guardada = await this.solicitudRepository.guardarAsignacion(solicitud, anterior);
        if (!guardada) {
            throw new ConflictException("La solicitud cambió mientras se asignaba. Recarga para ver su estado.");
        }

        // 7. Avisar al profesional; si el aviso falla, la asignación no se deshace
        try {
            await this.notificador.notificarAsignacion({
                solicitudId: solicitud.id,
                agronomoUsuarioId: agronomo.usuarioId,
            });
        } catch (error) {
            this.logger.warn(
                `No se pudo notificar la asignación de la solicitud ${solicitud.id}: ${error instanceof Error ? error.message : String(error)}`,
            );
        }

        return solicitud;
    }
}
