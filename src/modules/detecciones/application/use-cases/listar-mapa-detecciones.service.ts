import { Inject, Injectable } from "@nestjs/common";
import type { DeteccionVista, IListarMapaDeteccionesUseCase } from "../../domain/ports/in/monitor-detecciones.port";
import {
    LECTURA_DETECCIONES,
    type FiltrosDetecciones,
    type ILecturaDetecciones,
} from "../../domain/ports/out/lectura-detecciones.port";
import { aDeteccionVista, validarFiltros } from "./deteccion-vista";

// Detecciones con coordenadas para la capa del mapa de casos, con los filtros del monitor
@Injectable()
export class ListarMapaDeteccionesService implements IListarMapaDeteccionesUseCase {
    constructor(
        @Inject(LECTURA_DETECCIONES)
        private readonly lecturaDetecciones: ILecturaDetecciones,
    ) {}

    async ejecutar(consulta: { filtros: FiltrosDetecciones; limite: number }): Promise<DeteccionVista[]> {
        validarFiltros(consulta.filtros);

        const filas = await this.lecturaDetecciones.listarMapa(consulta.filtros, consulta.limite);

        return filas.map(aDeteccionVista);
    }
}
