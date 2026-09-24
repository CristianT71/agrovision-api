import { Inject, Injectable } from "@nestjs/common";
import type { IListarPlagasUseCase } from "../../domain/ports/in/gestionar-plagas.port";
import { PLAGA_REPOSITORY, type FiltrosPlaga, type IPlagaRepository } from "../../domain/ports/out/plaga.repository";
import type { Plaga } from "../../domain/entities/plaga.entity";

@Injectable()
export class ListarPlagasService implements IListarPlagasUseCase {
    constructor(
        @Inject(PLAGA_REPOSITORY)
        private readonly plagaRepository: IPlagaRepository,
    ) {}

    // RF-05.1 / RF-05.2: fichas ordenadas, filtradas por tipo y búsqueda libre con sinónimos
    async ejecutar(filtros: FiltrosPlaga): Promise<Plaga[]> {
        return await this.plagaRepository.findAll(filtros);
    }
}
