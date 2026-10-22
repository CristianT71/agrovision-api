import { Inject, Injectable } from "@nestjs/common";
import type { FotoSolicitudVista, IListarFotosSolicitudUseCase } from "../../domain/ports/in/solicitudes-app.port";
import {
    SOLICITUD_APP_REPOSITORY,
    type ISolicitudAppRepository,
} from "../../domain/ports/out/solicitud-app.repository";
import { VerificarAccesoSolicitudService } from "./verificar-acceso-solicitud.service";

@Injectable()
export class ListarFotosSolicitudService implements IListarFotosSolicitudUseCase {
    constructor(
        private readonly verificarAcceso: VerificarAccesoSolicitudService,
        @Inject(SOLICITUD_APP_REPOSITORY)
        private readonly solicitudAppRepository: ISolicitudAppRepository,
    ) {}

    async ejecutar(usuario: { id: string; rol: string }, solicitudId: string): Promise<FotoSolicitudVista[]> {
        // También confirma que la solicitud existe
        await this.verificarAcceso.ejecutar(usuario, solicitudId);

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
