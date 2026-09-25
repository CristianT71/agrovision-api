import { Inject, Injectable } from "@nestjs/common";
import type { IContarNoLeidasUseCase } from "../../domain/ports/in/gestionar-notificaciones.port";
import {
    NOTIFICACION_REPOSITORY,
    type INotificacionRepository,
} from "../../domain/ports/out/notificacion.repository";

// Contador de la campana: el frontend lo consulta periódicamente (sin WebSockets por ahora)
@Injectable()
export class ContarNoLeidasService implements IContarNoLeidasUseCase {
    constructor(
        @Inject(NOTIFICACION_REPOSITORY)
        private readonly notificacionRepository: INotificacionRepository,
    ) {}

    async ejecutar(consulta: { usuarioId: string }): Promise<{ total: number }> {
        return { total: await this.notificacionRepository.contarNoLeidas(consulta.usuarioId) };
    }
}
