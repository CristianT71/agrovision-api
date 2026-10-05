import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import type {
    IListarSolicitudesUseCase,
    ListarSolicitudesQuery,
    SolicitudVista,
} from "../../domain/ports/in/consultar-solicitudes.port";
import {
    LECTURA_SOLICITUDES,
    type FiltrosLecturaSolicitudes,
    type ILecturaSolicitudes,
} from "../../domain/ports/out/lectura-solicitudes.port";
import { AGRONOMO_REPOSITORY, type IAgronomoRepository } from "../../../agronomos/domain/ports/out/agronomo.repository";

@Injectable()
export class ListarSolicitudesService implements IListarSolicitudesUseCase {
    constructor(
        @Inject(LECTURA_SOLICITUDES)
        private readonly lecturaSolicitudes: ILecturaSolicitudes,
        @Inject(AGRONOMO_REPOSITORY)
        private readonly agronomoRepository: IAgronomoRepository,
    ) {}

    async ejecutar(consulta: ListarSolicitudesQuery): Promise<SolicitudVista[]> {
        const filtros: FiltrosLecturaSolicitudes = {
            estado: consulta.estado,
            agronomoId: consulta.agronomoId,
            busqueda: consulta.busqueda,
        };

        // RF-03.3: "mis asignadas" se resuelve con el agrónomo del token, no con un id del cliente
        if (consulta.soloMias) {
            filtros.agronomoId = await this.obtenerAgronomoId(consulta.usuario);
        }

        const resultados = await this.lecturaSolicitudes.listar(filtros);
        return resultados.map(({ solicitud, productorNombre }) => Object.assign(solicitud, { productorNombre }));
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
