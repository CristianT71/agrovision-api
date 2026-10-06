import { Injectable, NotFoundException } from "@nestjs/common";
import type { IConsultaSolicitudes } from "../../../../domain/ports/out/consulta-solicitudes.port";
import type { ContextoSolicitud } from "../../../../domain/services/canal-coordinacion";
import { ObtenerSolicitudPorIdService } from "../../../../../solicitudes/application/use-cases/obtener-solicitud-por-id.service";
import { ListarSolicitudesService } from "../../../../../solicitudes/application/use-cases/listar-solicitudes.service";

// El canal no toca la persistencia de solicitudes: se apoya solo en los casos de uso
// que SolicitudesModule ya exporta.
@Injectable()
export class SolicitudesConsultaAdapter implements IConsultaSolicitudes {
    constructor(
        private readonly obtenerSolicitudPorIdService: ObtenerSolicitudPorIdService,
        private readonly listarSolicitudesService: ListarSolicitudesService,
    ) {}

    async obtenerContexto(solicitudId: string): Promise<ContextoSolicitud | null> {
        try {
            const solicitud = await this.obtenerSolicitudPorIdService.obtenerInterno(solicitudId);

            return { id: solicitud.id, agronomoId: solicitud.agronomoId, estado: solicitud.estado };
        } catch (error) {
            // "No existe" es una respuesta válida para el canal; cualquier otro fallo se propaga
            if (error instanceof NotFoundException) return null;
            throw error;
        }
    }

    async listarIdsAsignadas(agronomoId: string): Promise<string[]> {
        // Aquí ya se tradujo el usuario a su agrónomo: se lista directo por agronomoId
        const solicitudes = await this.listarSolicitudesService.listarPorAgronomo(agronomoId);

        return solicitudes.map((solicitud) => solicitud.id);
    }
}
