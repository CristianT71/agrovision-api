import { Inject, Injectable } from "@nestjs/common";
import type { IListarProductoresUseCase } from "../../domain/ports/in/gestionar-productores.port";
import {
    PRODUCTOR_REPOSITORY,
    type FiltrosProductor,
    type IProductorRepository,
} from "../../domain/ports/out/productor.repository";
import type { Productor } from "../../domain/entities/productor.entity";

@Injectable()
export class ListarProductoresService implements IListarProductoresUseCase {
    constructor(
        @Inject(PRODUCTOR_REPOSITORY)
        private readonly productorRepository: IProductorRepository,
    ) {}

    // RF-10.1 / RF-10.2: el administrador filtra por estado, consentimiento, municipio o texto
    async ejecutar(filtros: FiltrosProductor): Promise<Productor[]> {
        return await this.productorRepository.findAll(filtros);
    }
}
