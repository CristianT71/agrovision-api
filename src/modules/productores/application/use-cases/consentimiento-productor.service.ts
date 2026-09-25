import { Inject, Injectable } from "@nestjs/common";
import type {
    CriterioProductor,
    IConsentimientoProductorUseCase,
} from "../../domain/ports/in/gestionar-productores.port";
import { PRODUCTOR_REPOSITORY, type IProductorRepository } from "../../domain/ports/out/productor.repository";
import type { Productor } from "../../domain/entities/productor.entity";
import { ObtenerProductorService } from "./obtener-productor.service";

@Injectable()
export class ConsentimientoProductorService implements IConsentimientoProductorUseCase {
    constructor(
        @Inject(PRODUCTOR_REPOSITORY)
        private readonly productorRepository: IProductorRepository,
        private readonly obtenerProductorService: ObtenerProductorService,
    ) {}

    // RF-10.2: el consentimiento queda fechado al otorgarse
    async otorgar(criterio: CriterioProductor): Promise<Productor> {
        const productor = await this.obtenerProductorService.ejecutar(criterio);
        productor.otorgarConsentimiento();

        return await this.productorRepository.guardar(productor);
    }

    // RF-10.3: la revocación exige confirmación explícita
    async revocar(criterio: CriterioProductor, confirmacion: boolean): Promise<Productor> {
        const productor = await this.obtenerProductorService.ejecutar(criterio);
        productor.revocarConsentimiento(confirmacion);

        return await this.productorRepository.guardar(productor);
    }
}
