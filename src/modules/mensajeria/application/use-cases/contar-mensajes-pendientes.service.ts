import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import type {
    Actor,
    IContarMensajesPendientesUseCase,
    ResumenPendientes,
} from "../../domain/ports/in/gestionar-mensajes.port";
import { MENSAJE_REPOSITORY, type IMensajeRepository } from "../../domain/ports/out/mensaje.repository";
import { CONSULTA_SOLICITUDES, type IConsultaSolicitudes } from "../../domain/ports/out/consulta-solicitudes.port";
import { CONSULTA_AGRONOMOS, type IConsultaAgronomos } from "../../domain/ports/out/consulta-agronomos.port";
import type { AutorTipo } from "../../domain/entities/mensaje.entity";
import type { PendientesPorSolicitud } from "../../domain/ports/out/mensaje.repository";

// RF-08.6: el frontend consulta este contador periódicamente para avisar de mensajes nuevos
@Injectable()
export class ContarMensajesPendientesService implements IContarMensajesPendientesUseCase {
    constructor(
        @Inject(MENSAJE_REPOSITORY)
        private readonly mensajeRepository: IMensajeRepository,
        @Inject(CONSULTA_SOLICITUDES)
        private readonly consultaSolicitudes: IConsultaSolicitudes,
        @Inject(CONSULTA_AGRONOMOS)
        private readonly consultaAgronomos: IConsultaAgronomos,
    ) {}

    async ejecutar(consulta: { actor: Actor }): Promise<ResumenPendientes> {
        const lector = this.resolverLector(consulta.actor.rol);
        let filas: PendientesPorSolicitud[];

        if (lector === "admin") {
            // El coordinador ve los pendientes de todas las solicitudes
            filas = await this.mensajeRepository.contarPendientes("admin");
        } else {
            const agronomoId = await this.consultaAgronomos.obtenerAgronomoIdPorUsuario(consulta.actor.usuarioId);
            if (!agronomoId) {
                throw new ForbiddenException("No existe un perfil de agrónomo asociado a esta cuenta.");
            }

            const solicitudIds = await this.consultaSolicitudes.listarIdsAsignadas(agronomoId);
            // Sin solicitudes asignadas no hay nada que contar: se evita la consulta
            if (solicitudIds.length === 0) {
                return { total: 0, porSolicitud: [] };
            }

            filas = await this.mensajeRepository.contarPendientes("agronomo", solicitudIds);
        }

        const porSolicitud = filas.filter((fila) => fila.pendientes > 0);
        const total = porSolicitud.reduce((suma, fila) => suma + fila.pendientes, 0);

        return { total, porSolicitud };
    }

    private resolverLector(rol: string): AutorTipo {
        if (rol === "admin" || rol === "agronomo") return rol;

        throw new ForbiddenException("No tienes acceso al canal de coordinación.");
    }
}
