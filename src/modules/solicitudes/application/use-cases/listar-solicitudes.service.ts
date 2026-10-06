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

        // El agrónomo solo ve lo que tiene asignado: su agrónomo sale del token y se ignoran
        // agronomoId y soloMias del cliente (RF-03.3). "Mis asignadas" no aplica al administrador.
        if (consulta.usuario.rol === "agronomo" || consulta.soloMias) {
            filtros.agronomoId = await this.obtenerAgronomoId(consulta.usuario);
        }

        return await this.listarConFiltros(filtros);
    }

    // Solo para otros módulos (mensajería), que ya tradujeron el usuario a su agrónomo.
    // Nunca se expone por HTTP.
    async listarPorAgronomo(agronomoId: string): Promise<SolicitudVista[]> {
        return await this.listarConFiltros({ agronomoId });
    }

    private async listarConFiltros(filtros: FiltrosLecturaSolicitudes): Promise<SolicitudVista[]> {
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
