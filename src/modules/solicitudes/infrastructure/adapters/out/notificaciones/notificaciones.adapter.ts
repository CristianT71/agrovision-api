import { Injectable } from "@nestjs/common";
import type { INotificadorSolicitudes } from "../../../../domain/ports/out/notificador-solicitudes.port";
import { CrearNotificacionesService } from "../../../../../notificaciones/application/use-cases/crear-notificaciones.service";

// Traduce los eventos de solicitudes a notificaciones en la campana del usuario (RF-02.5)
@Injectable()
export class NotificacionesSolicitudesAdapter implements INotificadorSolicitudes {
    constructor(private readonly crearNotificacionesService: CrearNotificacionesService) {}

    async notificarAsignacion(datos: { solicitudId: string; agronomoUsuarioId: string }): Promise<void> {
        await this.crearNotificacionesService.ejecutar([
            {
                usuarioId: datos.agronomoUsuarioId,
                tipo: "solicitud_asignada",
                titulo: "Tienes una solicitud asignada",
                descripcion: "Coordinación te delegó un caso para revisar.",
                referenciaTipo: "solicitud",
                referenciaId: datos.solicitudId,
            },
        ]);
    }

    async hayAlertaPlagasDesde(desde: Date): Promise<boolean> {
        return await this.crearNotificacionesService.seEmitioDesde("alerta_plaga", desde);
    }

    async notificarAlertaPlagas(datos: { casos: number; umbral: number }): Promise<void> {
        // Sin referencia: el aviso es del conjunto de casos de la semana, no de una solicitud
        await this.crearNotificacionesService.notificarRol("admin", {
            tipo: "alerta_plaga",
            titulo: `Alerta: ${datos.casos} plagas nuevas esta semana`,
            descripcion: `Se superó el umbral de ${datos.umbral} casos por semana. Se sugiere revisar el reentrenamiento del modelo.`,
        });
    }
}
