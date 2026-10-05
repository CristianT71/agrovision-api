import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { FotoSolicitudVista, IListarFotosSolicitudUseCase } from "../../domain/ports/in/solicitudes-app.port";
import {
    SOLICITUD_APP_REPOSITORY,
    type ISolicitudAppRepository,
} from "../../domain/ports/out/solicitud-app.repository";
import { SOLICITUD_REPOSITORY, type ISolicitudRepository } from "../../domain/ports/out/solicitud.repository";

@Injectable()
export class ListarFotosSolicitudService implements IListarFotosSolicitudUseCase {
    constructor(
        @Inject(SOLICITUD_REPOSITORY)
        private readonly solicitudRepository: ISolicitudRepository,
        @Inject(SOLICITUD_APP_REPOSITORY)
        private readonly solicitudAppRepository: ISolicitudAppRepository,
    ) {}

    async ejecutar(solicitudId: string): Promise<FotoSolicitudVista[]> {
        const solicitud = await this.solicitudRepository.findById(solicitudId);
        if (!solicitud) {
            throw new NotFoundException(`La solicitud con ID ${solicitudId} no fue encontrada.`);
        }

        const fotos = await this.solicitudAppRepository.listarFotos(solicitudId);

        // La ruta interna nunca sale del servidor: el panel descarga por el endpoint protegido
        return fotos.map((foto) => ({
            id: foto.id,
            angulo: foto.angulo,
            orden: foto.orden,
            tipoMime: foto.tipoMime,
            subida: foto.estaSubida(),
        }));
    }
}
