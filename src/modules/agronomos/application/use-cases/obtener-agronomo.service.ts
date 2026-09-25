import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { DetalleAgronomo, IObtenerAgronomoUseCase } from "../../domain/ports/in/gestionar-agronomos.port";
import { AGRONOMO_REPOSITORY, type IAgronomoRepository } from "../../domain/ports/out/agronomo.repository";

@Injectable()
export class ObtenerAgronomoService implements IObtenerAgronomoUseCase {
    constructor(
        @Inject(AGRONOMO_REPOSITORY)
        private readonly agronomoRepository: IAgronomoRepository,
    ) {}

    // Por id (el administrador revisa un agrónomo) o por usuario (el agrónomo ve su perfil)
    async ejecutar(criterio: { id: string } | { usuarioId: string }): Promise<DetalleAgronomo> {
        const agronomo =
            "id" in criterio
                ? await this.agronomoRepository.findById(criterio.id)
                : await this.agronomoRepository.findByUsuarioId(criterio.usuarioId);

        if (!agronomo) {
            throw new NotFoundException("El agrónomo no fue encontrado.");
        }

        const [documentos, carga] = await Promise.all([
            this.agronomoRepository.findDocumentos(agronomo.id),
            this.agronomoRepository.contarCasosActivos([agronomo.id]),
        ]);

        return {
            ...agronomo,
            casosActivos: carga.get(agronomo.id) ?? 0,
            documentos: documentos.map((documento) => ({
                id: documento.id,
                nombreOriginal: documento.nombreOriginal,
                tipoMime: documento.tipoMime,
                tamanoBytes: documento.tamanoBytes,
                fechaSubida: documento.fechaSubida,
            })),
        };
    }
}
