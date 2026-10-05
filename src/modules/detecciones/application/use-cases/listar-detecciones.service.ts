import { Inject, Injectable } from "@nestjs/common";
import type { IListarDeteccionesUseCase, PaginaDetecciones } from "../../domain/ports/in/monitor-detecciones.port";
import {
    LECTURA_DETECCIONES,
    type FiltrosDetecciones,
    type ILecturaDetecciones,
} from "../../domain/ports/out/lectura-detecciones.port";
import { aDeteccionVista, validarFiltros } from "./deteccion-vista";

// RF-07.1 a RF-07.4: monitor de inferencias crudas, la más reciente primero
@Injectable()
export class ListarDeteccionesService implements IListarDeteccionesUseCase {
    constructor(
        @Inject(LECTURA_DETECCIONES)
        private readonly lecturaDetecciones: ILecturaDetecciones,
    ) {}

    async ejecutar(consulta: {
        filtros: FiltrosDetecciones;
        pagina: number;
        limite: number;
    }): Promise<PaginaDetecciones> {
        validarFiltros(consulta.filtros);

        const { total, filas } = await this.lecturaDetecciones.listar(consulta.filtros, {
            numero: consulta.pagina,
            limite: consulta.limite,
        });

        return { datos: filas.map(aDeteccionVista), total, pagina: consulta.pagina, limite: consulta.limite };
    }
}
