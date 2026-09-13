import { Inject, Injectable } from "@nestjs/common";
import type {
    IListarSolicitudesUseCase,
    FiltrosSolicitudQuery,
} from "../../domain/ports/in/consultar-solicitudes.port";
import type { ISolicitudRepository } from "../../domain/ports/out/solicitud.repository";
import { SOLICITUD_REPOSITORY } from "../../domain/ports/out/solicitud.repository";
import type { Solicitud } from "../../domain/entities/solicitud.entity";

@Injectable()
export class ListarSolicitudesService implements IListarSolicitudesUseCase {
    constructor(
        @Inject(SOLICITUD_REPOSITORY)
        private readonly solicitudRepository: ISolicitudRepository,
    ) {}

    async ejecutar(filtros?: FiltrosSolicitudQuery): Promise<Solicitud[]> {
        return await this.solicitudRepository.findAll(filtros);
    }
}
