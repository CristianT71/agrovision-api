import { ConflictException, Inject, Injectable } from "@nestjs/common";
import type { IValidarProductorUseCase } from "../../domain/ports/in/gestionar-productores.port";
import { PRODUCTOR_REPOSITORY, type IProductorRepository } from "../../domain/ports/out/productor.repository";
import type { Productor } from "../../domain/entities/productor.entity";
import { ObtenerProductorService } from "./obtener-productor.service";

@Injectable()
export class ValidarProductorService implements IValidarProductorUseCase {
    constructor(
        @Inject(PRODUCTOR_REPOSITORY)
        private readonly productorRepository: IProductorRepository,
        private readonly obtenerProductorService: ObtenerProductorService,
    ) {}

    async ejecutar(productorId: string): Promise<Productor> {
        const productor = await this.obtenerProductorService.ejecutar({ id: productorId });

        // Regla de Negocio (RF-10.2): solo un productor registrado pasa a validado
        productor.validar();

        // Solo se escribe el estado: guardar el perfil completo podría restaurar un consentimiento
        // revocado por otra petición entre la lectura y la escritura
        if (!(await this.productorRepository.guardarValidacion(productor))) {
            throw new ConflictException("El productor cambió mientras se procesaba la operación. Vuelve a intentarlo.");
        }

        return productor;
    }
}
