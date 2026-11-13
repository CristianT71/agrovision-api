import { Inject, Injectable, ParseUUIDPipe, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { GESTION_VUELOS, type IGestionVuelos } from "../../../../../domain/ports/in/vuelos.port";

// Los guards corren antes que el interceptor multipart: no escribe para vuelos inexistentes o UUID inválidos.
@Injectable()
export class VueloExistenteGuard implements CanActivate {
    constructor(@Inject(GESTION_VUELOS) private readonly gestion: IGestionVuelos) {}
    async canActivate(contexto: ExecutionContext) {
        const req = contexto.switchToHttp().getRequest<{ params: { id: string } }>();
        await new ParseUUIDPipe().transform(req.params.id, { type: "param", data: "id", metatype: String });
        await this.gestion.exigirVuelo(req.params.id);
        return true;
    }
}
