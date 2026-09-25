import { ConflictException, Inject, Injectable } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";
import type { DatosFichaPlaga, ICrearPlagaUseCase } from "../../domain/ports/in/gestionar-plagas.port";
import { PLAGA_REPOSITORY, type IPlagaRepository } from "../../domain/ports/out/plaga.repository";
import { Plaga } from "../../domain/entities/plaga.entity";

@Injectable()
export class CrearPlagaService implements ICrearPlagaUseCase {
    constructor(
        @Inject(PLAGA_REPOSITORY)
        private readonly plagaRepository: IPlagaRepository,
    ) {}

    async ejecutar(datos: DatosFichaPlaga): Promise<Plaga> {
        const nombreCientifico = datos.nombreCientifico?.trim() || null;

        // El nombre científico identifica la especie: no puede repetirse en el catálogo
        if (nombreCientifico && (await this.plagaRepository.existeNombreCientifico(nombreCientifico))) {
            throw new ConflictException(`Ya existe una ficha con el nombre científico "${nombreCientifico}".`);
        }

        // RF-05.4: el dominio exige los campos mínimos y la ficha nace sin aval ni protocolo químico
        const plaga = Plaga.crear({ ...datos, id: uuidv4(), nombreCientifico });

        return await this.plagaRepository.guardar(plaga);
    }
}
