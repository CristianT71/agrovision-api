import { Inject, Injectable } from "@nestjs/common";
import type { Actor, IListarMensajesUseCase, MensajeVista } from "../../domain/ports/in/gestionar-mensajes.port";
import { MENSAJE_REPOSITORY, type IMensajeRepository } from "../../domain/ports/out/mensaje.repository";
import { CONSULTA_SOLICITUDES, type IConsultaSolicitudes } from "../../domain/ports/out/consulta-solicitudes.port";
import { CONSULTA_AGRONOMOS, type IConsultaAgronomos } from "../../domain/ports/out/consulta-agronomos.port";
import { resolverActor } from "./resolver-actor";
import { aMensajeVista } from "./mensaje-vista";

@Injectable()
export class ListarMensajesService implements IListarMensajesUseCase {
    constructor(
        @Inject(MENSAJE_REPOSITORY)
        private readonly mensajeRepository: IMensajeRepository,
        @Inject(CONSULTA_SOLICITUDES)
        private readonly consultaSolicitudes: IConsultaSolicitudes,
        @Inject(CONSULTA_AGRONOMOS)
        private readonly consultaAgronomos: IConsultaAgronomos,
    ) {}

    // RF-04.9: la bitácora se consulta sin efectos secundarios. Marcar como leído
    // es una acción explícita del cliente (PATCH .../leidos), no un efecto de listar.
    async ejecutar(consulta: { actor: Actor; solicitudId: string }): Promise<MensajeVista[]> {
        await resolverActor(consulta.actor, consulta.solicitudId, this.consultaSolicitudes, this.consultaAgronomos);

        const mensajes = await this.mensajeRepository.listarPorSolicitud(consulta.solicitudId);

        return mensajes.map(aMensajeVista);
    }
}
