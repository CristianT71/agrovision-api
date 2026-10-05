import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { DeteccionVista, IObtenerDeteccionUseCase } from "../../domain/ports/in/monitor-detecciones.port";
import { LECTURA_DETECCIONES, type ILecturaDetecciones } from "../../domain/ports/out/lectura-detecciones.port";
import { aDeteccionVista } from "./deteccion-vista";

@Injectable()
export class ObtenerDeteccionService implements IObtenerDeteccionUseCase {
    constructor(
        @Inject(LECTURA_DETECCIONES)
        private readonly lecturaDetecciones: ILecturaDetecciones,
    ) {}

    async ejecutar(id: string): Promise<DeteccionVista> {
        const leida = await this.lecturaDetecciones.obtener(id);

        if (!leida) {
            throw new NotFoundException(`La detección con ID ${id} no fue encontrada.`);
        }

        return aDeteccionVista(leida);
    }
}
