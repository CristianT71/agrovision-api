import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { CriterioProductor, IObtenerProductorUseCase } from "../../domain/ports/in/gestionar-productores.port";
import { PRODUCTOR_REPOSITORY, type IProductorRepository } from "../../domain/ports/out/productor.repository";
import type { Productor } from "../../domain/entities/productor.entity";

@Injectable()
export class ObtenerProductorService implements IObtenerProductorUseCase {
    constructor(
        @Inject(PRODUCTOR_REPOSITORY)
        private readonly productorRepository: IProductorRepository,
    ) {}

    async ejecutar(criterio: CriterioProductor): Promise<Productor> {
        const productor =
            "id" in criterio
                ? await this.productorRepository.findById(criterio.id)
                : await this.productorRepository.findByUsuarioId(criterio.usuarioId);

        if (!productor) {
            throw new NotFoundException(
                "id" in criterio
                    ? `El productor con ID ${criterio.id} no existe.`
                    : "Aún no has completado tu perfil de productor.",
            );
        }

        return productor;
    }
}
