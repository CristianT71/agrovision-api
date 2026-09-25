import type { Notificacion } from "../../domain/entities/notificacion.entity";
import type { NotificacionVista } from "../../domain/ports/in/gestionar-notificaciones.port";

// El usuarioId no se devuelve: una notificación solo la ve su destinatario
export function aNotificacionVista(notificacion: Notificacion): NotificacionVista {
    return {
        id: notificacion.id,
        tipo: notificacion.tipo,
        titulo: notificacion.titulo,
        descripcion: notificacion.descripcion,
        referenciaTipo: notificacion.referenciaTipo,
        referenciaId: notificacion.referenciaId,
        leida: notificacion.leida,
        fecha: notificacion.fecha,
    };
}
