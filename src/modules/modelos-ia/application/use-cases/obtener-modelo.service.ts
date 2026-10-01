import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { IObtenerModeloUseCase, ModeloVista } from "../../domain/ports/in/gestionar-modelos.port";
import { MODELO_IA_REPOSITORY, type IModeloIaRepository } from "../../domain/ports/out/modelo-ia.repository";
import { aModeloVista } from "./modelo-vista";

@Injectable()
export class ObtenerModeloService implements IObtenerModeloUseCase {
    constructor(
        @Inject(MODELO_IA_REPOSITORY)
        private readonly modeloRepository: IModeloIaRepository,
    ) {}

    async ejecutar(id: string): Promise<ModeloVista> {
        const modelo = await this.modeloRepository.findById(id);

        if (!modelo) {
            throw new NotFoundException(`El modelo con ID ${id} no existe.`);
        }

        return aModeloVista(modelo);
    }
}
