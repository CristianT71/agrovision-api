// Error que lanza el dominio cuando una operación viola una regla de negocio.
// No depende de NestJS: el filtro global lo traduce a 409 Conflict.
export class ReglaNegocioError extends Error {
    constructor(mensaje: string) {
        super(mensaje);
        this.name = "ReglaNegocioError";
    }
}
