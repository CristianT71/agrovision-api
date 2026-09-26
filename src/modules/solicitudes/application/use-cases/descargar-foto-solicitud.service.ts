import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { IDescargarFotoSolicitudUseCase } from "../../domain/ports/in/solicitudes-app.port";
import {
    SOLICITUD_APP_REPOSITORY,
    type ISolicitudAppRepository,
} from "../../domain/ports/out/solicitud-app.repository";
import {
    ALMACENAMIENTO_ARCHIVOS,
    type IAlmacenamientoArchivos,
} from "../../../../common/almacenamiento/almacenamiento.port";
import type { FotoSolicitud } from "../../domain/entities/foto-solicitud.entity";

@Injectable()
export class DescargarFotoSolicitudService implements IDescargarFotoSolicitudUseCase {
    constructor(
        @Inject(SOLICITUD_APP_REPOSITORY)
        private readonly solicitudAppRepository: ISolicitudAppRepository,
        @Inject(ALMACENAMIENTO_ARCHIVOS)
        private readonly almacenamiento: IAlmacenamientoArchivos,
    ) {}

    async ejecutar(consulta: { solicitudId: string; fotoId: string }): Promise<{
        foto: FotoSolicitud;
        contenido: Buffer;
    }> {
        const foto = await this.solicitudAppRepository.findFotoById(consulta.fotoId);

        // La foto debe ser de ESA solicitud y ya estar subida: un 404 uniforme evita revelar
        // que existe en otra solicitud
        if (!foto || foto.solicitudId !== consulta.solicitudId || !foto.ruta) {
            throw new NotFoundException("La foto no fue encontrada.");
        }

        const contenido = await this.almacenamiento.leerPrivado(foto.ruta);

        return { foto, contenido };
    }
}
