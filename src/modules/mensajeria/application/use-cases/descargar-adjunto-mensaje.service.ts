import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Actor, IDescargarAdjuntoMensajeUseCase } from "../../domain/ports/in/gestionar-mensajes.port";
import { MENSAJE_REPOSITORY, type IMensajeRepository } from "../../domain/ports/out/mensaje.repository";
import { CONSULTA_SOLICITUDES, type IConsultaSolicitudes } from "../../domain/ports/out/consulta-solicitudes.port";
import { CONSULTA_AGRONOMOS, type IConsultaAgronomos } from "../../domain/ports/out/consulta-agronomos.port";
import {
    ALMACENAMIENTO_ARCHIVOS,
    type IAlmacenamientoArchivos,
} from "../../../../common/almacenamiento/almacenamiento.port";
import type { AdjuntoMensaje } from "../../domain/entities/adjunto-mensaje.entity";
import { resolverActor } from "./resolver-actor";

@Injectable()
export class DescargarAdjuntoMensajeService implements IDescargarAdjuntoMensajeUseCase {
    constructor(
        @Inject(MENSAJE_REPOSITORY)
        private readonly mensajeRepository: IMensajeRepository,
        @Inject(CONSULTA_SOLICITUDES)
        private readonly consultaSolicitudes: IConsultaSolicitudes,
        @Inject(CONSULTA_AGRONOMOS)
        private readonly consultaAgronomos: IConsultaAgronomos,
        @Inject(ALMACENAMIENTO_ARCHIVOS)
        private readonly almacenamiento: IAlmacenamientoArchivos,
    ) {}

    async ejecutar(consulta: {
        actor: Actor;
        solicitudId: string;
        mensajeId: string;
        adjuntoId: string;
    }): Promise<{ adjunto: AdjuntoMensaje; contenido: Buffer }> {
        await resolverActor(consulta.actor, consulta.solicitudId, this.consultaSolicitudes, this.consultaAgronomos);

        const mensaje = await this.mensajeRepository.findById(consulta.mensajeId);
        const adjunto = mensaje?.adjuntos.find((candidato) => candidato.id === consulta.adjuntoId);

        // El mensaje debe pertenecer a ESA solicitud y el adjunto a ESE mensaje: un 404
        // uniforme evita revelar que el archivo existe en otra solicitud
        if (!mensaje || mensaje.solicitudId !== consulta.solicitudId || !adjunto) {
            throw new NotFoundException("El adjunto no fue encontrado.");
        }

        const contenido = await this.almacenamiento.leerPrivado(adjunto.ruta);

        return { adjunto, contenido };
    }
}
