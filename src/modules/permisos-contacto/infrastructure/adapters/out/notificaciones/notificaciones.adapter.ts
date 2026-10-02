import { Injectable } from "@nestjs/common";
import type { INotificadorPermisos } from "../../../../domain/ports/out/notificador-permisos.port";
import { CrearNotificacionesService } from "../../../../../notificaciones/application/use-cases/crear-notificaciones.service";

// Traduce los cambios del permiso a notificaciones en la campana del agrónomo (RF-02.5)
@Injectable()
export class NotificacionesPermisosAdapter implements INotificadorPermisos {
    constructor(private readonly crearNotificacionesService: CrearNotificacionesService) {}

    async notificarPermisoOtorgado(datos: { solicitudId: string; agronomoUsuarioId: string }): Promise<void> {
        await this.crearNotificacionesService.ejecutar([
            {
                usuarioId: datos.agronomoUsuarioId,
                tipo: "permiso_contacto",
                titulo: "Ya puedes contactar al productor",
                descripcion: "Coordinación habilitó el contacto directo con el productor del caso.",
                referenciaTipo: "solicitud",
                referenciaId: datos.solicitudId,
            },
        ]);
    }

    async notificarPermisoRevocado(datos: { solicitudId: string; agronomoUsuarioId: string }): Promise<void> {
        await this.crearNotificacionesService.ejecutar([
            {
                usuarioId: datos.agronomoUsuarioId,
                tipo: "permiso_contacto",
                titulo: "Contacto con el productor retirado",
                descripcion: "Coordinación retiró el contacto directo con el productor del caso.",
                referenciaTipo: "solicitud",
                referenciaId: datos.solicitudId,
            },
        ]);
    }
}
