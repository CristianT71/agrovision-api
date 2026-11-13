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
