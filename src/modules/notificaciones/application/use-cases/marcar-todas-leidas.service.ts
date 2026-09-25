import { Inject, Injectable } from "@nestjs/common";
import type { IMarcarTodasLeidasUseCase } from "../../domain/ports/in/gestionar-notificaciones.port";
import {
    NOTIFICACION_REPOSITORY,
    type INotificacionRepository,
} from "../../domain/ports/out/notificacion.repository";

// RF-02.6: vaciar la campana de una sola vez
@Injectable()
export class MarcarTodasLeidasService implements IMarcarTodasLeidasUseCase {
    constructor(
        @Inject(NOTIFICACION_REPOSITORY)
        private readonly notificacionRepository: INotificacionRepository,
    ) {}

    async ejecutar(comando: { usuarioId: string }): Promise<{ marcadas: number }> {
        return { marcadas: await this.notificacionRepository.marcarTodasLeidas(comando.usuarioId) };
    }
}
