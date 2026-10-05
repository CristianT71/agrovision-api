import { Inject, Injectable } from "@nestjs/common";
import type { IResumirDeteccionesUseCase, ResumenDetecciones } from "../../domain/ports/in/monitor-detecciones.port";
import {
    LECTURA_DETECCIONES,
    type FiltrosDetecciones,
    type ILecturaDetecciones,
} from "../../domain/ports/out/lectura-detecciones.port";
import { validarFiltros } from "./deteccion-vista";

// Totales por categoría con los mismos filtros del listado: cabecera del monitor (RF-07.2 a RF-07.4)
@Injectable()
export class ResumirDeteccionesService implements IResumirDeteccionesUseCase {
    constructor(
        @Inject(LECTURA_DETECCIONES)
        private readonly lecturaDetecciones: ILecturaDetecciones,
    ) {}

    async ejecutar(filtros: FiltrosDetecciones): Promise<ResumenDetecciones> {
        validarFiltros(filtros);

        const porCategoria = await this.lecturaDetecciones.resumir(filtros);

        return {
            total: porCategoria.reduce((suma, fila) => suma + fila.total, 0),
            divergentes: porCategoria.reduce((suma, fila) => suma + fila.divergentes, 0),
            defectuosas: porCategoria.reduce((suma, fila) => suma + fila.defectuosas, 0),
            porCategoria,
        };
    }
}
