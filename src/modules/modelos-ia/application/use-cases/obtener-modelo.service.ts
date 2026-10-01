import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
    VENTANA_ADOPCION_DIAS,
    type IObtenerModeloUseCase,
    type ModeloVista,
} from "../../domain/ports/in/gestionar-modelos.port";
import { MODELO_IA_REPOSITORY, type IModeloIaRepository } from "../../domain/ports/out/modelo-ia.repository";
import { CONSULTA_ADOPCION, type IConsultaAdopcion } from "../../domain/ports/out/consulta-adopcion.port";
import { aModeloVista } from "./modelo-vista";

@Injectable()
export class ObtenerModeloService implements IObtenerModeloUseCase {
    constructor(
        @Inject(MODELO_IA_REPOSITORY)
        private readonly modeloRepository: IModeloIaRepository,
        @Inject(CONSULTA_ADOPCION)
        private readonly consultaAdopcion: IConsultaAdopcion,
    ) {}

    async ejecutar(id: string): Promise<ModeloVista> {
        const modelo = await this.modeloRepository.findById(id);

        if (!modelo) {
            throw new NotFoundException(`El modelo con ID ${id} no existe.`);
        }

        const desde = new Date(Date.now() - VENTANA_ADOPCION_DIAS * 24 * 60 * 60 * 1000);
        return aModeloVista(modelo, await this.consultaAdopcion.adopcionPorModelo(desde));
    }
}
