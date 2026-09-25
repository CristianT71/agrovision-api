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
}
