import { Inject, Injectable } from "@nestjs/common";
import {
    VENTANA_ADOPCION_DIAS,
    type IListarModelosUseCase,
    type ModeloVista,
} from "../../domain/ports/in/gestionar-modelos.port";
import { MODELO_IA_REPOSITORY, type IModeloIaRepository } from "../../domain/ports/out/modelo-ia.repository";
import { CONSULTA_ADOPCION, type IConsultaAdopcion } from "../../domain/ports/out/consulta-adopcion.port";
import type { Canal } from "../../domain/entities/modelo-ia.entity";
import { aModeloVista } from "./modelo-vista";

// RF-09.1: inventario de empaquetados con versión, canal, compatibilidad y penetración instalada
@Injectable()
export class ListarModelosService implements IListarModelosUseCase {
    constructor(
        @Inject(MODELO_IA_REPOSITORY)
        private readonly modeloRepository: IModeloIaRepository,
        @Inject(CONSULTA_ADOPCION)
        private readonly consultaAdopcion: IConsultaAdopcion,
    ) {}

    async ejecutar(filtros: { canal?: Canal }): Promise<ModeloVista[]> {
        const desde = new Date(Date.now() - VENTANA_ADOPCION_DIAS * 24 * 60 * 60 * 1000);
        const [modelos, adopcion] = await Promise.all([
            this.modeloRepository.findAll(filtros),
            this.consultaAdopcion.adopcionPorModelo(desde),
        ]);

        return modelos.map((modelo) => aModeloVista(modelo, adopcion));
    }
}
