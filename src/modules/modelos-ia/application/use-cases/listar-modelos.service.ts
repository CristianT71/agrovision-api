import { Inject, Injectable } from "@nestjs/common";
import type { IListarModelosUseCase, ModeloVista } from "../../domain/ports/in/gestionar-modelos.port";
import { MODELO_IA_REPOSITORY, type IModeloIaRepository } from "../../domain/ports/out/modelo-ia.repository";
import type { Canal } from "../../domain/entities/modelo-ia.entity";
import { aModeloVista } from "./modelo-vista";

// RF-09.1: inventario de empaquetados con versión, canal y compatibilidad
@Injectable()
export class ListarModelosService implements IListarModelosUseCase {
    constructor(
        @Inject(MODELO_IA_REPOSITORY)
        private readonly modeloRepository: IModeloIaRepository,
    ) {}

    async ejecutar(filtros: { canal?: Canal }): Promise<ModeloVista[]> {
        const modelos = await this.modeloRepository.findAll(filtros);
        return modelos.map(aModeloVista);
    }
}
