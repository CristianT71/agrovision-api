import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";
import type {
    EnviarMensajeCommand,
    IEnviarMensajeUseCase,
    MensajeVista,
} from "../../domain/ports/in/gestionar-mensajes.port";
import { MENSAJE_REPOSITORY, type IMensajeRepository } from "../../domain/ports/out/mensaje.repository";
import { CONSULTA_SOLICITUDES, type IConsultaSolicitudes } from "../../domain/ports/out/consulta-solicitudes.port";
import { CONSULTA_AGRONOMOS, type IConsultaAgronomos } from "../../domain/ports/out/consulta-agronomos.port";
import {
    ALMACENAMIENTO_ARCHIVOS,
    type IAlmacenamientoArchivos,
} from "../../../../common/almacenamiento/almacenamiento.port";
import { AdjuntoMensaje } from "../../domain/entities/adjunto-mensaje.entity";
import { MAX_ADJUNTOS_POR_MENSAJE, Mensaje } from "../../domain/entities/mensaje.entity";
import { validarEnvio } from "../../domain/services/canal-coordinacion";
import { resolverActor } from "./resolver-actor";
import { aMensajeVista } from "./mensaje-vista";

@Injectable()
export class EnviarMensajeService implements IEnviarMensajeUseCase {
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

    async ejecutar(comando: EnviarMensajeCommand): Promise<MensajeVista> {
        // 1. Solo el administrador y el agrónomo asignado participan en el canal
        const { contexto, autorTipo } = await resolverActor(
            comando.actor,
            comando.solicitudId,
            this.consultaSolicitudes,
            this.consultaAgronomos,
        );

        // 2. RF-08.7: sin evaluador asignado (o con el canal cerrado) no se admiten mensajes
        validarEnvio(contexto);

        // 3. El límite se revisa antes de subir nada: no se escriben archivos que luego se borran
        if (comando.archivos.length > MAX_ADJUNTOS_POR_MENSAJE) {
            throw new BadRequestException(`Un mensaje admite como máximo ${MAX_ADJUNTOS_POR_MENSAJE} adjuntos.`);
        }

        const mensajeId = uuidv4();
        const adjuntos: AdjuntoMensaje[] = [];

        try {
            // 4. Los adjuntos van a almacenamiento privado (RF-08.5)
            for (const archivo of comando.archivos) {
                const ruta = await this.almacenamiento.guardarPrivado(`mensajes/${comando.solicitudId}`, archivo);
                adjuntos.push(
                    new AdjuntoMensaje(
                        uuidv4(),
                        mensajeId,
                        ruta,
                        archivo.nombreOriginal,
                        archivo.tipoMime,
                        archivo.contenido.length,
                        AdjuntoMensaje.tipoDesdeMime(archivo.tipoMime),
                    ),
                );
            }

            const mensaje = Mensaje.crear({
                id: mensajeId,
                solicitudId: comando.solicitudId,
                autorId: comando.actor.usuarioId,
                autorTipo,
                contenido: comando.contenido,
                adjuntos,
            });

            return aMensajeVista(await this.mensajeRepository.guardar(mensaje));
        } catch (error) {
            // Si algo falla no quedan archivos huérfanos de un mensaje que no existe
            await Promise.all(adjuntos.map((adjunto) => this.almacenamiento.eliminarPrivado(adjunto.ruta)));
            throw error;
        }
    }
}
