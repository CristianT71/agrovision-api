import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { IObtenerPlagaUseCase } from "../../domain/ports/in/gestionar-plagas.port";
import { PLAGA_REPOSITORY, type IPlagaRepository } from "../../domain/ports/out/plaga.repository";
import type { Plaga } from "../../domain/entities/plaga.entity";

@Injectable()
export class ObtenerPlagaService implements IObtenerPlagaUseCase {
    constructor(
        @Inject(PLAGA_REPOSITORY)
        private readonly plagaRepository: IPlagaRepository,
    ) {}

    async ejecutar(id: string): Promise<Plaga> {
        const plaga = await this.plagaRepository.findById(id);

        if (!plaga) {
            throw new NotFoundException(`La ficha con ID ${id} no existe.`);
        }

        return plaga;
    }
}
