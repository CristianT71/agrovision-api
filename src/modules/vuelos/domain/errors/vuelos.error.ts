import { ReglaNegocioError } from "../../../../common/errors/regla-negocio.error";

export class VueloNoEncontradoError extends ReglaNegocioError {
    constructor() {
        super("El vuelo no existe.");
    }
}
export class ArchivoVueloNoEncontradoError extends ReglaNegocioError {
    constructor() {
        super("El archivo no existe en este vuelo.");
    }
}
export class FormatoVueloError extends ReglaNegocioError {
    constructor(
        public readonly estado: 413 | 415 | 422,
        mensaje: string,
    ) {
        super(mensaje);
    }
}
export class TokenMedioError extends ReglaNegocioError {
    constructor(public readonly vencido = false) {
        super(vencido ? "El enlace ha vencido." : "El enlace es inválido.");
    }
}
// Errores del asistente de IA (n8n). Los mensajes son aptos para mostrarse en el panel.
export class AsistenteNoConfiguradoError extends ReglaNegocioError {
    constructor() {
        super("El asistente aún no está configurado.");
    }
}
export class AsistenteOcupadoError extends ReglaNegocioError {
    constructor(public readonly agotado = false) {
        super(
            agotado
                ? "El asistente tardó demasiado en responder. Inténtalo de nuevo."
                : "El asistente está ocupado o tuvo un problema. Espera un minuto e inténtalo de nuevo.",
        );
    }
}
export class InformeAsistenteError extends ReglaNegocioError {
    constructor(
        public readonly estado: 400 | 404 | 410,
        mensaje: string,
    ) {
        super(mensaje);
    }
}
