import { Inject, Injectable } from "@nestjs/common";
import type {
    IListarNotificacionesUseCase,
    PaginaNotificaciones,
} from "../../domain/ports/in/gestionar-notificaciones.port";
import {
    NOTIFICACION_REPOSITORY,
    type INotificacionRepository,
} from "../../domain/ports/out/notificacion.repository";
import { aNotificacionVista } from "./notificacion-vista";

// RF-02.5: cada usuario ve únicamente sus propias notificaciones
@Injectable()
export class ListarNotificacionesService implements IListarNotificacionesUseCase {
    constructor(
        @Inject(NOTIFICACION_REPOSITORY)
        private readonly notificacionRepository: INotificacionRepository,
    ) {}

    async ejecutar(consulta: {
        usuarioId: string;
        soloNoLeidas?: boolean;
        pagina: number;
        limite: number;
    }): Promise<PaginaNotificaciones> {
        const { items, total } = await this.notificacionRepository.listarPorUsuario(consulta.usuarioId, {
            soloNoLeidas: consulta.soloNoLeidas,
            pagina: consulta.pagina,
            limite: consulta.limite,
        });

        return {
            items: items.map(aNotificacionVista),
            total,
            pagina: consulta.pagina,
            limite: consulta.limite,
        };
    }
}
