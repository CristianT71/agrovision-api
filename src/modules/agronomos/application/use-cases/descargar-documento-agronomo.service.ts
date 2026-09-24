import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { IDescargarDocumentoAgronomoUseCase } from "../../domain/ports/in/gestionar-agronomos.port";
import { AGRONOMO_REPOSITORY, type IAgronomoRepository } from "../../domain/ports/out/agronomo.repository";
import {
    ALMACENAMIENTO_ARCHIVOS,
    type IAlmacenamientoArchivos,
} from "../../../../common/almacenamiento/almacenamiento.port";
import type { DocumentoAcreditacion } from "../../domain/entities/documento-acreditacion.entity";

@Injectable()
export class DescargarDocumentoAgronomoService implements IDescargarDocumentoAgronomoUseCase {
    constructor(
        @Inject(AGRONOMO_REPOSITORY)
        private readonly agronomoRepository: IAgronomoRepository,
        @Inject(ALMACENAMIENTO_ARCHIVOS)
        private readonly almacenamiento: IAlmacenamientoArchivos,
    ) {}

    async ejecutar(consulta: {
        agronomoId: string;
        documentoId: string;
    }): Promise<{ documento: DocumentoAcreditacion; contenido: Buffer }> {
        // Se busca por agrónomo y documento juntos: no se puede pedir un documento ajeno cambiando la URL
        const documento = await this.agronomoRepository.findDocumento(consulta.agronomoId, consulta.documentoId);

        if (!documento) {
            throw new NotFoundException("El documento no fue encontrado.");
        }

        const contenido = await this.almacenamiento.leerPrivado(documento.ruta);

        return { documento, contenido };
    }
}
