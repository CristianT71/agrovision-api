import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
    IMarcarNotificacionLeidaUseCase,
    NotificacionVista,
} from "../../domain/ports/in/gestionar-notificaciones.port";
import { NOTIFICACION_REPOSITORY, type INotificacionRepository } from "../../domain/ports/out/notificacion.repository";
import { aNotificacionVista } from "./notificacion-vista";

// RF-02.6: pasar una notificación de "no leída" a "leída"
@Injectable()
export class MarcarNotificacionLeidaService implements IMarcarNotificacionLeidaUseCase {
    constructor(
        @Inject(NOTIFICACION_REPOSITORY)
        private readonly notificacionRepository: INotificacionRepository,
    ) {}

    async ejecutar(comando: { usuarioId: string; notificacionId: string }): Promise<NotificacionVista> {
        const notificacion = await this.notificacionRepository.findById(comando.notificacionId);

        // La de otro usuario se responde igual que una inexistente: no se revela que existe
        if (!notificacion || !notificacion.perteneceA(comando.usuarioId)) {
            throw new NotFoundException(`La notificación con ID ${comando.notificacionId} no fue encontrada.`);
        }

        notificacion.marcarLeida();

        return aNotificacionVista(await this.notificacionRepository.guardar(notificacion));
    }
}
