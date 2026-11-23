import { Inject, Injectable, Logger } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";
import type {
    ICrearNotificacionesUseCase,
    NuevaNotificacion,
} from "../../domain/ports/in/gestionar-notificaciones.port";
import { NOTIFICACION_REPOSITORY, type INotificacionRepository } from "../../domain/ports/out/notificacion.repository";
import { ENVIADOR_CORREO, type IEnviadorCorreo } from "../../domain/ports/out/enviador-correo.port";
import { CONSULTA_USUARIOS, type IConsultaUsuarios } from "../../domain/ports/out/consulta-usuarios.port";
import { Notificacion, type TipoNotificacion } from "../../domain/entities/notificacion.entity";

// Puerta de entrada del resto del sistema: los demás módulos notifican por aquí (RF-02.5)
@Injectable()
export class CrearNotificacionesService implements ICrearNotificacionesUseCase {
    constructor(
        @Inject(NOTIFICACION_REPOSITORY)
        private readonly notificacionRepository: INotificacionRepository,
        @Inject(CONSULTA_USUARIOS)
        private readonly consultaUsuarios: IConsultaUsuarios,
        @Inject(ENVIADOR_CORREO)
        private readonly enviadorCorreo: IEnviadorCorreo,
    ) {}

    private readonly logger = new Logger(CrearNotificacionesService.name);

    async ejecutar(datos: NuevaNotificacion[], opciones?: { evitarDuplicadasNoLeidas?: boolean }): Promise<number> {
        // Sin destinatarios no se consulta nada
        if (datos.length === 0) return 0;

        const pendientes = opciones?.evitarDuplicadasNoLeidas ? await this.sinDuplicadas(datos) : datos;

        if (pendientes.length === 0) return 0;

        const notificaciones = pendientes.map((dato) =>
            Notificacion.crear({
                id: uuidv4(),
                usuarioId: dato.usuarioId,
                tipo: dato.tipo,
                titulo: dato.titulo,
                descripcion: dato.descripcion,
                referenciaTipo: dato.referenciaTipo,
                referenciaId: dato.referenciaId,
            }),
        );

        await this.notificacionRepository.guardarVarias(notificaciones);

        // El correo es un extra: no se espera y un fallo nunca tumba la notificación ya guardada
        void this.enviarPorCorreo(notificaciones).catch((error: unknown) =>
            this.logger.warn(
                `No se pudo enviar el correo de aviso: ${error instanceof Error ? error.message : String(error)}`,
            ),
        );

        return notificaciones.length;
    }

    private async enviarPorCorreo(notificaciones: Notificacion[]): Promise<void> {
        const destinos = await this.consultaUsuarios.obtenerCorreosDeAviso(notificaciones.map((n) => n.usuarioId));
        const correoDe = new Map(destinos.map((destino) => [destino.usuarioId, destino.correo]));

        for (const notificacion of notificaciones) {
            const correo = correoDe.get(notificacion.usuarioId);
            if (!correo) continue;

            try {
                await this.enviadorCorreo.enviar(
                    correo,
                    `AgroVision: ${notificacion.titulo}`,
                    `${notificacion.descripcion}\n\nEntra al panel de AgroVision para verlo.\nPuedes dejar de recibir estos correos en Ajustes.`,
                );
            } catch (error) {
                // Un destinatario con problemas no impide avisar a los demás
                this.logger.warn(
                    `Correo a ${correo} no enviado: ${error instanceof Error ? error.message : String(error)}`,
                );
            }
        }
    }

    async notificarRol(
        rol: string,
        datos: Omit<NuevaNotificacion, "usuarioId">,
        opciones?: { excluirUsuarioId?: string; evitarDuplicadasNoLeidas?: boolean },
    ): Promise<number> {
        const usuarioIds = await this.consultaUsuarios.listarIdsActivosPorRol(rol);

        // Nunca se avisa a quien provocó el evento
        const destinatarios = usuarioIds.filter((usuarioId) => usuarioId !== opciones?.excluirUsuarioId);

        return await this.ejecutar(
            destinatarios.map((usuarioId) => ({ ...datos, usuarioId })),
            { evitarDuplicadasNoLeidas: opciones?.evitarDuplicadasNoLeidas },
        );
    }

    async seEmitioDesde(tipo: TipoNotificacion, desde: Date): Promise<boolean> {
        return await this.notificacionRepository.existeDeTipoDesde(tipo, desde);
    }

    // Un chat activo no debe llenar la campana del mismo aviso: mientras el usuario no lea
    // el anterior de la misma referencia, no se crea otro
    private async sinDuplicadas(datos: NuevaNotificacion[]): Promise<NuevaNotificacion[]> {
        const conservar: NuevaNotificacion[] = [];

        for (const dato of datos) {
            if (!dato.referenciaId) {
                conservar.push(dato);
                continue;
            }

            const yaAvisado = await this.notificacionRepository.existeNoLeida(
                dato.usuarioId,
                dato.tipo,
                dato.referenciaId,
            );

            if (!yaAvisado) conservar.push(dato);
        }

        return conservar;
    }
}
