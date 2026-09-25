import { ReglaNegocioError } from "../../../../common/errors/regla-negocio.error";
import type { AdjuntoMensaje } from "./adjunto-mensaje.entity";

// Los dos lados del canal interno: todos los administradores comparten el lado "admin"
export type AutorTipo = "admin" | "agronomo";

export const MAX_LONGITUD_MENSAJE = 2000;
export const MAX_ADJUNTOS_POR_MENSAJE = 5;

// Entrada de la bitácora de coordinación de una solicitud (RF-04.9)
export class Mensaje {
    constructor(
        public readonly id: string,
        public readonly solicitudId: string,
        // Id de la cuenta de login (usuarios.id) que escribió el mensaje
        public readonly autorId: string,
        public readonly autorTipo: AutorTipo,
        public readonly contenido: string | null,
        public readonly fecha: Date,
        public leido: boolean,
        public readonly adjuntos: AdjuntoMensaje[] = [],
    ) {}

    // Regla de Negocio (RF-04.9, RF-08.5): un mensaje es texto, adjuntos, o ambos
    public static crear(datos: {
        id: string;
        solicitudId: string;
        autorId: string;
        autorTipo: AutorTipo;
        contenido?: string | null;
        adjuntos?: AdjuntoMensaje[];
    }): Mensaje {
        const contenido = datos.contenido?.trim() ? datos.contenido.trim() : null;
        const adjuntos = datos.adjuntos ?? [];

        if (!contenido && adjuntos.length === 0) {
            throw new ReglaNegocioError("El mensaje debe tener texto o al menos un adjunto.");
        }

        if (contenido && contenido.length > MAX_LONGITUD_MENSAJE) {
            throw new ReglaNegocioError(`El mensaje no puede superar ${MAX_LONGITUD_MENSAJE} caracteres.`);
        }

        if (adjuntos.length > MAX_ADJUNTOS_POR_MENSAJE) {
            throw new ReglaNegocioError(`Un mensaje admite como máximo ${MAX_ADJUNTOS_POR_MENSAJE} adjuntos.`);
        }

        return new Mensaje(
            datos.id,
            datos.solicitudId,
            datos.autorId,
            datos.autorTipo,
            contenido,
            new Date(),
            false,
            adjuntos,
        );
    }

    // RF-08.6: un mensaje solo queda pendiente para la contraparte, nunca para quien lo escribió
    public estaPendientePara(lector: AutorTipo): boolean {
        return !this.leido && this.autorTipo !== lector;
    }
}
