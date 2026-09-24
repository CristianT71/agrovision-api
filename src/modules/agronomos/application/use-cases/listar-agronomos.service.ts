import { Inject, Injectable } from "@nestjs/common";
import type { AgronomoConCarga, IListarAgronomosUseCase } from "../../domain/ports/in/gestionar-agronomos.port";
import {
    AGRONOMO_REPOSITORY,
    type FiltrosAgronomo,
    type IAgronomoRepository,
} from "../../domain/ports/out/agronomo.repository";

@Injectable()
export class ListarAgronomosService implements IListarAgronomosUseCase {
    constructor(
        @Inject(AGRONOMO_REPOSITORY)
        private readonly agronomoRepository: IAgronomoRepository,
    ) {}

    async ejecutar(filtros: FiltrosAgronomo): Promise<AgronomoConCarga[]> {
        const agronomos = await this.agronomoRepository.findAll(filtros);

        // RF-08.4: la carga de casos se consulta en bloque, no una consulta por agrónomo
        const carga = await this.agronomoRepository.contarCasosActivos(agronomos.map((agronomo) => agronomo.id));

        return agronomos.map((agronomo) => ({ ...agronomo, casosActivos: carga.get(agronomo.id) ?? 0 }));
    }
}
