import { Inject, Injectable } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";
import type {
    ICrearNotificacionesUseCase,
    NuevaNotificacion,
} from "../../domain/ports/in/gestionar-notificaciones.port";
import {
    NOTIFICACION_REPOSITORY,
    type INotificacionRepository,
} from "../../domain/ports/out/notificacion.repository";
import { CONSULTA_USUARIOS, type IConsultaUsuarios } from "../../domain/ports/out/consulta-usuarios.port";
import { Notificacion } from "../../domain/entities/notificacion.entity";

// Puerta de entrada del resto del sistema: los demás módulos notifican por aquí (RF-02.5)
@Injectable()
export class CrearNotificacionesService implements ICrearNotificacionesUseCase {
    constructor(
        @Inject(NOTIFICACION_REPOSITORY)
        private readonly notificacionRepository: INotificacionRepository,
        @Inject(CONSULTA_USUARIOS)
        private readonly consultaUsuarios: IConsultaUsuarios,
    ) {}

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

        return notificaciones.length;
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
