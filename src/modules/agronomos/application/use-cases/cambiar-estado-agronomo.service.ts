import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
    AccionEstadoAgronomo,
    ICambiarEstadoAgronomoUseCase,
} from "../../domain/ports/in/gestionar-agronomos.port";
import { AGRONOMO_REPOSITORY, type IAgronomoRepository } from "../../domain/ports/out/agronomo.repository";
import type { Agronomo } from "../../domain/entities/agronomo.entity";

@Injectable()
export class CambiarEstadoAgronomoService implements ICambiarEstadoAgronomoUseCase {
    constructor(
        @Inject(AGRONOMO_REPOSITORY)
        private readonly agronomoRepository: IAgronomoRepository,
    ) {}

    async ejecutar(comando: { agronomoId: string; accion: AccionEstadoAgronomo }): Promise<Agronomo> {
        const agronomo = await this.agronomoRepository.findById(comando.agronomoId);

        if (!agronomo) {
            throw new NotFoundException(`El agrónomo con ID ${comando.agronomoId} no existe.`);
        }

        // Las reglas de cada transición viven en el dominio (RF-10.5)
        switch (comando.accion) {
            case "validar":
                agronomo.validar();
                break;
            case "desactivar":
                agronomo.desactivar();
                break;
            case "reactivar":
                agronomo.reactivar();
                break;
        }

        return await this.agronomoRepository.guardar(agronomo);
    }
}
