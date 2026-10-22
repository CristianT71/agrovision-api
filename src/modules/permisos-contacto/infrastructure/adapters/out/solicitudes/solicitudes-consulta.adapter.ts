import { Injectable, NotFoundException } from "@nestjs/common";
import type { IConsultaSolicitudes } from "../../../../domain/ports/out/consulta-solicitudes.port";
import type { ContextoSolicitud } from "../../../../domain/entities/permiso-contacto.entity";
import { ObtenerSolicitudPorIdService } from "../../../../../solicitudes/application/use-cases/obtener-solicitud-por-id.service";

// El permiso no toca la persistencia de solicitudes: se apoya solo en los casos de uso
// que SolicitudesModule ya exporta.
@Injectable()
export class SolicitudesConsultaAdapter implements IConsultaSolicitudes {
    constructor(private readonly obtenerSolicitudPorIdService: ObtenerSolicitudPorIdService) {}

    async obtenerContexto(solicitudId: string): Promise<ContextoSolicitud | null> {
        try {
            const solicitud = await this.obtenerSolicitudPorIdService.obtenerInterno(solicitudId);

            return {
                id: solicitud.id,
                productorId: solicitud.productorId,
                agronomoId: solicitud.agronomoId,
                estado: solicitud.estado,
            };
        } catch (error) {
            // "No existe" es una respuesta válida para el permiso; cualquier otro fallo se propaga
            if (error instanceof NotFoundException) return null;
            throw error;
        }
    }
}
