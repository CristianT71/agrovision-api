import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import type {
    IListarSolicitudesUseCase,
    ListarSolicitudesQuery,
} from "../../domain/ports/in/consultar-solicitudes.port";
import type { ISolicitudRepository, FiltrosSolicitud } from "../../domain/ports/out/solicitud.repository";
import { SOLICITUD_REPOSITORY } from "../../domain/ports/out/solicitud.repository";
import { AGRONOMO_REPOSITORY, type IAgronomoRepository } from "../../../agronomos/domain/ports/out/agronomo.repository";
import type { Solicitud } from "../../domain/entities/solicitud.entity";

@Injectable()
export class ListarSolicitudesService implements IListarSolicitudesUseCase {
    constructor(
        @Inject(SOLICITUD_REPOSITORY)
        private readonly solicitudRepository: ISolicitudRepository,
        @Inject(AGRONOMO_REPOSITORY)
        private readonly agronomoRepository: IAgronomoRepository,
    ) {}

    async ejecutar(consulta: ListarSolicitudesQuery): Promise<Solicitud[]> {
        const filtros: FiltrosSolicitud = { estado: consulta.estado, agronomoId: consulta.agronomoId };

        // RF-03.3: "mis asignadas" se resuelve con el agrónomo del token, no con un id del cliente
        if (consulta.soloMias) {
            filtros.agronomoId = await this.obtenerAgronomoId(consulta.usuario);
        }

        return await this.solicitudRepository.findAll(filtros);
    }

    private async obtenerAgronomoId(usuario: { id: string; rol: string }): Promise<string> {
        if (usuario.rol !== "agronomo") {
            throw new ForbiddenException("El filtro de solicitudes asignadas solo aplica a agrónomos.");
        }

        const agronomo = await this.agronomoRepository.findByUsuarioId(usuario.id);
        if (!agronomo) {
            throw new ForbiddenException("No existe un perfil de agrónomo asociado a esta cuenta.");
        }

        return agronomo.id;
    }
}
