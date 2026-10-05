import { Inject, Injectable } from "@nestjs/common";
import type {
    EstadoSolicitudApp,
    IListarMisSolicitudesUseCase,
    ListarMisSolicitudesQuery,
    MiSolicitudApp,
} from "../../domain/ports/in/solicitudes-app.port";
import {
    SOLICITUD_APP_REPOSITORY,
    type ISolicitudAppRepository,
} from "../../domain/ports/out/solicitud-app.repository";
import {
    PRODUCTOR_REPOSITORY,
    type IProductorRepository,
} from "../../../productores/domain/ports/out/productor.repository";
import type { EstadoSolicitud, Solicitud } from "../../domain/entities/solicitud.entity";

// Estados del dominio traducidos a los que entiende la app móvil
const ESTADOS_APP: Record<EstadoSolicitud, EstadoSolicitudApp> = {
    Pendiente: "PENDING_UPLOAD",
    Enviada: "SUBMITTED",
    Asignada: "ASSIGNED",
    Resuelta: "RESOLVED",
    Descartada: "DISCARDED",
};

@Injectable()
export class ListarMisSolicitudesService implements IListarMisSolicitudesUseCase {
    constructor(
        @Inject(SOLICITUD_APP_REPOSITORY)
        private readonly solicitudAppRepository: ISolicitudAppRepository,
        @Inject(PRODUCTOR_REPOSITORY)
        private readonly productorRepository: IProductorRepository,
    ) {}

    async ejecutar(consulta: ListarMisSolicitudesQuery): Promise<MiSolicitudApp[]> {
        // Sin perfil de productor no puede haber creado solicitudes
        const productor = await this.productorRepository.findByUsuarioId(consulta.usuarioId);
        if (!productor) return [];

        const desde = consulta.desde === undefined ? undefined : new Date(consulta.desde);
        const solicitudes = await this.solicitudAppRepository.listarPorProductor(productor.id, desde);

        return solicitudes
            .filter((solicitud): solicitud is Solicitud & { idCliente: string } => solicitud.idCliente !== null)
            .map((solicitud) => ({
                id: solicitud.idCliente,
                status: ESTADOS_APP[solicitud.estado],
                resolutionType: solicitud.tipoResultado,
                // Hoy la resolución guarda el nombre de la plaga, no su id del catálogo
                resolvedPestId: null,
                agronomistResponse: solicitud.respuestaProfesional,
                resolvedAt: solicitud.fechaResolucion?.getTime() ?? null,
            }));
    }
}
