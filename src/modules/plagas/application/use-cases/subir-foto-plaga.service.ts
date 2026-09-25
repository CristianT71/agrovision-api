import { Inject, Injectable } from "@nestjs/common";
import type { ISubirFotoPlagaUseCase } from "../../domain/ports/in/gestionar-plagas.port";
import { PLAGA_REPOSITORY, type IPlagaRepository } from "../../domain/ports/out/plaga.repository";
import {
    ALMACENAMIENTO_ARCHIVOS,
    type ArchivoParaGuardar,
    type IAlmacenamientoArchivos,
} from "../../../../common/almacenamiento/almacenamiento.port";
import type { Plaga } from "../../domain/entities/plaga.entity";
import { ObtenerPlagaService } from "./obtener-plaga.service";

@Injectable()
export class SubirFotoPlagaService implements ISubirFotoPlagaUseCase {
    constructor(
        @Inject(PLAGA_REPOSITORY)
        private readonly plagaRepository: IPlagaRepository,
        @Inject(ALMACENAMIENTO_ARCHIVOS)
        private readonly almacenamiento: IAlmacenamientoArchivos,
        private readonly obtenerPlagaService: ObtenerPlagaService,
    ) {}

    async ejecutar(comando: { plagaId: string; archivo: ArchivoParaGuardar }): Promise<Plaga> {
        const plaga = await this.obtenerPlagaService.ejecutar(comando.plagaId);
        const fotoAnterior = plaga.fotoUrl;

        // Las fotos del catálogo son públicas: se muestran en el panel y en la app
        const url = await this.almacenamiento.guardarPublico("plagas", comando.archivo);

        let actualizada: Plaga;
        try {
            plaga.actualizarFicha({ fotoUrl: url });
            actualizada = await this.plagaRepository.guardar(plaga);
        } catch (error) {
            await this.almacenamiento.eliminarPublico(url);
            throw error;
        }

        // La foto anterior se borra solo cuando la nueva ya quedó guardada
        if (fotoAnterior) {
            await this.almacenamiento.eliminarPublico(fotoAnterior);
        }

        return actualizada;
    }
}
