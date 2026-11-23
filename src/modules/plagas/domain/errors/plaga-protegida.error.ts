import { ReglaNegocioError } from "../../../../common/errors/regla-negocio.error";

export class PlagaProtegidaError extends ReglaNegocioError {
    constructor() {
        super(
            "No se puede eliminar esta ficha protegida del catálogo original porque el modelo de IA depende de ella.",
        );
        this.name = "PlagaProtegidaError";
    }
}
