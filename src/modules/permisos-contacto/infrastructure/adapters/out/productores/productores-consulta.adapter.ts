import { Inject, Injectable } from "@nestjs/common";
import type { ContactoProductor, IConsultaProductores } from "../../../../domain/ports/out/consulta-productores.port";
import {
    PRODUCTOR_REPOSITORY,
    type IProductorRepository,
} from "../../../../../productores/domain/ports/out/productor.repository";

// Lee solo el nombre y el teléfono: el resto del perfil del productor no le interesa al permiso
@Injectable()
export class ProductoresConsultaAdapter implements IConsultaProductores {
    constructor(
        @Inject(PRODUCTOR_REPOSITORY)
        private readonly productorRepository: IProductorRepository,
    ) {}

    async obtenerContacto(productorId: string): Promise<ContactoProductor | null> {
        const productor = await this.productorRepository.findById(productorId);
        if (!productor) return null;

        return { nombre: productor.nombre, telefono: productor.telefono };
    }
}
