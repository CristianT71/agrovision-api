import { Inject, Injectable } from "@nestjs/common";
import type { IActualizarProtocoloQuimicoUseCase } from "../../domain/ports/in/gestionar-plagas.port";
import { PLAGA_REPOSITORY, type IPlagaRepository } from "../../domain/ports/out/plaga.repository";
import type { Plaga } from "../../domain/entities/plaga.entity";
import { ObtenerPlagaService } from "./obtener-plaga.service";

@Injectable()
export class ActualizarProtocoloQuimicoService implements IActualizarProtocoloQuimicoUseCase {
    constructor(
        @Inject(PLAGA_REPOSITORY)
        private readonly plagaRepository: IPlagaRepository,
        private readonly obtenerPlagaService: ObtenerPlagaService,
    ) {}

    async ejecutar(comando: { plagaId: string; protocoloQuimico: string }): Promise<Plaga> {
        const plaga = await this.obtenerPlagaService.ejecutar(comando.plagaId);

        // RF-05.6: el dominio bloquea el cambio si la ficha no tiene aval profesional
        plaga.actualizarProtocoloQuimico(comando.protocoloQuimico.trim());

        return await this.plagaRepository.guardar(plaga);
    }
}
