import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import {
    LIMITE_POR_DEFECTO,
    MAX_LIMITE,
    PAGINA_POR_DEFECTO,
    type IListarSolicitudesUseCase,
    type ListarSolicitudesQuery,
    type PaginaSolicitudes,
    type SolicitudVista,
} from "../../domain/ports/in/consultar-solicitudes.port";
import {
    LECTURA_SOLICITUDES,
    type FiltrosLecturaSolicitudes,
    type ILecturaSolicitudes,
    type SolicitudConProductor,
} from "../../domain/ports/out/lectura-solicitudes.port";
import { AGRONOMO_REPOSITORY, type IAgronomoRepository } from "../../../agronomos/domain/ports/out/agronomo.repository";
import { obtenerAgronomoIdDeCuenta } from "./verificar-acceso-solicitud.service";

@Injectable()
export class ListarSolicitudesService implements IListarSolicitudesUseCase {
    constructor(
        @Inject(LECTURA_SOLICITUDES)
        private readonly lecturaSolicitudes: ILecturaSolicitudes,
        @Inject(AGRONOMO_REPOSITORY)
        private readonly agronomoRepository: IAgronomoRepository,
    ) {}

    async ejecutar(consulta: ListarSolicitudesQuery): Promise<PaginaSolicitudes> {
        const { usuario } = consulta;
        const pagina = Math.max(PAGINA_POR_DEFECTO, Math.trunc(consulta.pagina ?? PAGINA_POR_DEFECTO));
        // El DTO ya rechaza más de 100; el tope se repite aquí para que ningún llamador barra la tabla
        const limite = Math.min(MAX_LIMITE, Math.max(1, Math.trunc(consulta.limite ?? LIMITE_POR_DEFECTO)));

        const filtros: FiltrosLecturaSolicitudes = { estado: consulta.estado, busqueda: consulta.busqueda };

        if (usuario.rol === "agronomo") {
            // El agrónomo solo ve lo que tiene asignado: su agrónomo sale del token y se ignoran
            // agronomoId y sinAsignar del cliente (RF-03.3)
            filtros.agronomoId = await obtenerAgronomoIdDeCuenta(this.agronomoRepository, usuario.id);
        } else if (usuario.rol === "admin") {
            filtros.agronomoId = consulta.agronomoId;
            filtros.sinAsignar = consulta.sinAsignar;
        } else {
            throw new ForbiddenException("La bandeja de solicitudes es solo para agrónomos y administradores.");
        }

        const { total, resultados } = await this.lecturaSolicitudes.listarPagina(filtros, { numero: pagina, limite });

        return { datos: resultados.map(aVista), total, pagina, limite };
    }

    // Solo para otros módulos (mensajería), que ya tradujeron el usuario a su agrónomo.
    // Nunca se expone por HTTP.
    async listarPorAgronomo(agronomoId: string): Promise<SolicitudVista[]> {
        const resultados = await this.lecturaSolicitudes.listar({ agronomoId });
        return resultados.map(aVista);
    }
}

function aVista({ solicitud, productorNombre }: SolicitudConProductor): SolicitudVista {
    return Object.assign(solicitud, { productorNombre });
}
