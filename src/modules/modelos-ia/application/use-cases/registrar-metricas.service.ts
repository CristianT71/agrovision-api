import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
    IRegistrarMetricasUseCase,
    ModeloVista,
    RegistrarMetricasCommand,
} from "../../domain/ports/in/gestionar-modelos.port";
import { MODELO_IA_REPOSITORY, type IModeloIaRepository } from "../../domain/ports/out/modelo-ia.repository";
import { MetricaModelo } from "../../domain/entities/metrica-modelo.entity";
import { aModeloVista } from "./modelo-vista";

// RF-09.2: precisión, sensibilidad (recall) y F1 de cada compilación
@Injectable()
export class RegistrarMetricasService implements IRegistrarMetricasUseCase {
    constructor(
        @Inject(MODELO_IA_REPOSITORY)
        private readonly modeloRepository: IModeloIaRepository,
    ) {}

    async ejecutar(comando: RegistrarMetricasCommand): Promise<ModeloVista> {
        const modelo = await this.modeloRepository.findById(comando.modeloId);

        if (!modelo) {
            throw new NotFoundException(`El modelo con ID ${comando.modeloId} no existe.`);
        }

        // Regla de negocio pura del dominio: valores entre 0 y 1, una global, clases sin repetir
        modelo.registrarMetricas([
            MetricaModelo.crear({ ...comando.global, clase: null }),
            ...(comando.porClase ?? []).map((metrica) => MetricaModelo.crear(metrica)),
        ]);

        await this.modeloRepository.guardarMetricas(modelo);

        return aModeloVista(modelo);
    }
}
