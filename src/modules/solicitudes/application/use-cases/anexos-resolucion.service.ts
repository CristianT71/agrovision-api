import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { LECTURA_SOLICITUDES, type ILecturaSolicitudes } from "../../domain/ports/out/lectura-solicitudes.port";
import {
    ALMACENAMIENTO_ARCHIVOS,
    type IAlmacenamientoArchivos,
} from "../../../../common/almacenamiento/almacenamiento.port";
import type { AnexoResolucion } from "../../domain/entities/anexo-resolucion.entity";

// Lo que ve el panel de cada anexo: la ruta interna nunca sale de la API
export interface AnexoResolucionVista {
    id: string;
    nombreOriginal: string;
    tipoMime: string;
    tamanoBytes: number;
    fechaSubida: Date;
}

// RF-04.6: consulta y descarga de los anexos de una resolución
@Injectable()
export class AnexosResolucionService {
    constructor(
        @Inject(LECTURA_SOLICITUDES)
        private readonly lecturaSolicitudes: ILecturaSolicitudes,
        @Inject(ALMACENAMIENTO_ARCHIVOS)
        private readonly almacenamiento: IAlmacenamientoArchivos,
    ) {}

    async listar(solicitudId: string): Promise<AnexoResolucionVista[]> {
        const anexos = await this.lecturaSolicitudes.listarAnexos(solicitudId);

        return anexos.map((anexo) => ({
            id: anexo.id,
            nombreOriginal: anexo.nombreOriginal,
            tipoMime: anexo.tipoMime,
            tamanoBytes: anexo.tamanoBytes,
            fechaSubida: anexo.fechaSubida,
        }));
    }

    async descargar(solicitudId: string, anexoId: string): Promise<{ anexo: AnexoResolucion; contenido: Buffer }> {
        // Se busca por solicitud y anexo juntos: no se puede pedir un anexo ajeno cambiando la URL
        const anexo = await this.lecturaSolicitudes.obtenerAnexo(solicitudId, anexoId);
        if (!anexo) {
            throw new NotFoundException("El anexo no fue encontrado.");
        }

        const contenido = await this.almacenamiento.leerPrivado(anexo.ruta);
        return { anexo, contenido };
    }
}
