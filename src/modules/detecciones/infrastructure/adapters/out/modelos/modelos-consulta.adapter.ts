import { Inject, Injectable } from "@nestjs/common";
import type { IConsultaModelos } from "../../../../domain/ports/out/consulta-modelos.port";
import {
    MODELO_IA_REPOSITORY,
    type IModeloIaRepository,
} from "../../../../../modelos-ia/domain/ports/out/modelo-ia.repository";

// Traduce la versión que envía la app al modelo del inventario (ModelosIaModule)
@Injectable()
export class ModelosConsultaAdapter implements IConsultaModelos {
    constructor(
        @Inject(MODELO_IA_REPOSITORY)
        private readonly modeloRepository: IModeloIaRepository,
    ) {}

    async obtenerIdPorVersion(version: string): Promise<string | null> {
        const modelo = await this.modeloRepository.findByVersion(version);
        return modelo?.id ?? null;
    }
}
