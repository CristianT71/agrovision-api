import { ReglaNegocioError } from "../../../../common/errors/regla-negocio.error";

// Códigos estables que el panel y la app usan para reaccionar sin depender del texto del mensaje.
export type CodigoErrorReglaZona =
    | "REGLA_NO_ENCONTRADA"
    | "REGLA_INVALIDA"
    | "REGLA_INMUTABLE"
    | "SIN_PERMISO_APROBAR"
    | "REGLA_NO_APROBADA"
    | "TRANSICION_INVALIDA"
    | "VERSION_EN_CONFLICTO";

export class ReglaZonaError extends ReglaNegocioError {
    constructor(
        public readonly codigo: CodigoErrorReglaZona,
        mensaje: string,
        public readonly detalles: string[] = [],
    ) {
        super(mensaje);
        this.name = "ReglaZonaError";
    }
}

export class ReglaNoEncontradaError extends ReglaZonaError {
    constructor() {
        super("REGLA_NO_ENCONTRADA", "La regla de zona no existe.");
    }
}
export class ReglaInvalidaError extends ReglaZonaError {
    constructor(detalles: string[]) {
        super("REGLA_INVALIDA", "La tabla de la regla no es válida.", detalles);
    }
}
export class ReglaInmutableError extends ReglaZonaError {
    constructor() {
        super(
            "REGLA_INMUTABLE",
            "Solo una regla en borrador se puede editar, aprobar o borrar. Duplícala para crear una nueva versión.",
        );
    }
}
export class SinPermisoAprobarError extends ReglaZonaError {
    constructor() {
        super("SIN_PERMISO_APROBAR", "Solo un agrónomo validado puede aprobar una regla de zona.");
    }
}
export class ReglaNoAprobadaError extends ReglaZonaError {
    constructor() {
        super("REGLA_NO_APROBADA", "Solo una regla aprobada se puede activar.");
    }
}
export class TransicionInvalidaError extends ReglaZonaError {
    constructor(mensaje: string) {
        super("TRANSICION_INVALIDA", mensaje);
    }
}
export class VersionEnConflictoError extends ReglaZonaError {
    constructor() {
        super("VERSION_EN_CONFLICTO", "Otra operación creó la misma versión al mismo tiempo. Inténtalo de nuevo.");
    }
}
// Mismo código estable que el choque de numeración: en ambos casos el cliente debe recargar y reintentar.
export class RevisionEnConflictoError extends ReglaZonaError {
    constructor() {
        super(
            "VERSION_EN_CONFLICTO",
            "El borrador cambió desde que lo abriste. Recarga la versión guardada antes de continuar.",
        );
    }
}
