import { Inject, Injectable } from "@nestjs/common";
import type { Actor, IMarcarMensajesLeidosUseCase } from "../../domain/ports/in/gestionar-mensajes.port";
import { MENSAJE_REPOSITORY, type IMensajeRepository } from "../../domain/ports/out/mensaje.repository";
import { CONSULTA_SOLICITUDES, type IConsultaSolicitudes } from "../../domain/ports/out/consulta-solicitudes.port";
import { CONSULTA_AGRONOMOS, type IConsultaAgronomos } from "../../domain/ports/out/consulta-agronomos.port";
import { resolverActor } from "./resolver-actor";

@Injectable()
export class MarcarMensajesLeidosService implements IMarcarMensajesLeidosUseCase {
    constructor(
        @Inject(MENSAJE_REPOSITORY)
        private readonly mensajeRepository: IMensajeRepository,
        @Inject(CONSULTA_SOLICITUDES)
        private readonly consultaSolicitudes: IConsultaSolicitudes,
        @Inject(CONSULTA_AGRONOMOS)
        private readonly consultaAgronomos: IConsultaAgronomos,
    ) {}

    // El lector sale del rol: cada lado del canal solo marca los mensajes de la contraparte
    async ejecutar(comando: { actor: Actor; solicitudId: string }): Promise<{ marcados: number }> {
        const { autorTipo } = await resolverActor(
            comando.actor,
            comando.solicitudId,
            this.consultaSolicitudes,
            this.consultaAgronomos,
        );

        const marcados = await this.mensajeRepository.marcarLeidos(comando.solicitudId, autorTipo);

        return { marcados };
    }
}
