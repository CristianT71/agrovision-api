import type { Mensaje } from "../../domain/entities/mensaje.entity";
import type { MensajeVista } from "../../domain/ports/in/gestionar-mensajes.port";

// Proyección hacia la API: deja fuera la ruta interna de cada adjunto
export function aMensajeVista(mensaje: Mensaje): MensajeVista {
    return {
        id: mensaje.id,
        solicitudId: mensaje.solicitudId,
        autorId: mensaje.autorId,
        autorTipo: mensaje.autorTipo,
        contenido: mensaje.contenido,
        fecha: mensaje.fecha,
        leido: mensaje.leido,
        adjuntos: mensaje.adjuntos.map((adjunto) => ({
            id: adjunto.id,
            nombreArchivo: adjunto.nombreArchivo,
            tipoMime: adjunto.tipoMime,
            tamanoBytes: adjunto.tamanoBytes,
            tipo: adjunto.tipo,
        })),
    };
}
