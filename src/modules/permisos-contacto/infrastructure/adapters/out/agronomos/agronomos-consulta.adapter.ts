import { Inject, Injectable } from "@nestjs/common";
import type { IConsultaAgronomos } from "../../../../domain/ports/out/consulta-agronomos.port";
import {
    AGRONOMO_REPOSITORY,
    type IAgronomoRepository,
} from "../../../../../agronomos/domain/ports/out/agronomo.repository";

// Traduce la cuenta de login del token al agrónomo que las solicitudes referencian
@Injectable()
export class AgronomosConsultaAdapter implements IConsultaAgronomos {
    constructor(
        @Inject(AGRONOMO_REPOSITORY)
        private readonly agronomoRepository: IAgronomoRepository,
    ) {}

    async obtenerAgronomoIdPorUsuario(usuarioId: string): Promise<string | null> {
        const agronomo = await this.agronomoRepository.findByUsuarioId(usuarioId);

        return agronomo?.id ?? null;
    }
}
