import { ConflictException, Inject, Injectable } from "@nestjs/common";
import type { DatosFichaPlaga, IActualizarPlagaUseCase } from "../../domain/ports/in/gestionar-plagas.port";
import { PLAGA_REPOSITORY, type IPlagaRepository } from "../../domain/ports/out/plaga.repository";
import type { Plaga } from "../../domain/entities/plaga.entity";
import { ObtenerPlagaService } from "./obtener-plaga.service";

@Injectable()
export class ActualizarPlagaService implements IActualizarPlagaUseCase {
    constructor(
        @Inject(PLAGA_REPOSITORY)
        private readonly plagaRepository: IPlagaRepository,
        private readonly obtenerPlagaService: ObtenerPlagaService,
    ) {}

    // RF-05.3: reescribe la ficha botánica. El protocolo químico no se toca aquí (RF-05.6)
    async ejecutar(id: string, cambios: Partial<DatosFichaPlaga>): Promise<Plaga> {
        const plaga = await this.obtenerPlagaService.ejecutar(id);
        const { sinonimos, hospederos, ...ficha } = cambios;

        if (ficha.nombreCientifico !== undefined) {
            ficha.nombreCientifico = ficha.nombreCientifico?.trim() || null;

            if (
                ficha.nombreCientifico &&
                (await this.plagaRepository.existeNombreCientifico(ficha.nombreCientifico, id))
            ) {
                throw new ConflictException(
                    `Ya existe otra ficha con el nombre científico "${ficha.nombreCientifico}".`,
                );
            }
        }

        plaga.actualizarFicha(ficha);

        // RF-05.5: listas dinámicas; si llegan, reemplazan la lista completa
        if (sinonimos !== undefined) plaga.reemplazarSinonimos(sinonimos);
        if (hospederos !== undefined) plaga.reemplazarHospederos(hospederos);

        return await this.plagaRepository.guardar(plaga);
    }
}
