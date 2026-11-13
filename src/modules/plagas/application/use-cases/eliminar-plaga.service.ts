import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { IEliminarPlagaUseCase } from "../../domain/ports/in/gestionar-plagas.port";
import { PLAGA_REPOSITORY, type IPlagaRepository } from "../../domain/ports/out/plaga.repository";
import {
    ALMACENAMIENTO_ARCHIVOS,
    type IAlmacenamientoArchivos,
} from "../../../../common/almacenamiento/almacenamiento.port";
import { RUTA_FOTO_CATALOGO } from "../../../../common/almacenamiento/fotos-catalogo-publicas";
import { ObtenerPlagaService } from "./obtener-plaga.service";

@Injectable()
export class EliminarPlagaService implements IEliminarPlagaUseCase {
    constructor(
        @Inject(PLAGA_REPOSITORY)
        private readonly plagaRepository: IPlagaRepository,
        @Inject(ALMACENAMIENTO_ARCHIVOS)
        private readonly almacenamiento: IAlmacenamientoArchivos,
        private readonly obtenerPlagaService: ObtenerPlagaService,
    ) {}

    async ejecutar(id: string): Promise<void> {
        const plaga = await this.obtenerPlagaService.ejecutar(id);
        plaga.validarEliminacion();

        if (!(await this.plagaRepository.eliminar(id))) {
            throw new NotFoundException(`La ficha con ID ${id} no existe.`);
        }

        // Solo después de confirmar el DELETE, y únicamente fotos propias del catálogo sin referencias.
        if (
            plaga.fotoUrl &&
            RUTA_FOTO_CATALOGO.test(plaga.fotoUrl) &&
            !(await this.plagaRepository.fotoEnUso(plaga.fotoUrl))
        ) {
            await this.almacenamiento.eliminarPublico(plaga.fotoUrl);
        }
    }
}
