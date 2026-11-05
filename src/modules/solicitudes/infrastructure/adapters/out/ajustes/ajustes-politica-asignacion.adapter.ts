import { Injectable } from "@nestjs/common";
import type { IPoliticaAsignacion, PoliticaAsignacion } from "../../../../domain/ports/out/politica-asignacion.port";
import { AjustesService } from "../../../../../ajustes/application/use-cases/ajustes.service";
import { cargaMaximaComoNumero } from "../../../../../ajustes/domain/ajustes";

// Lee del módulo de ajustes lo que el administrador configuró para repartir los casos
@Injectable()
export class AjustesPoliticaAsignacionAdapter implements IPoliticaAsignacion {
    constructor(private readonly ajustesService: AjustesService) {}

    async obtener(): Promise<PoliticaAsignacion> {
        const ajustes = await this.ajustesService.obtenerSistema();
        return {
            asignacionAutomatica: ajustes.asignacionAutomatica,
            cargaMaxima: cargaMaximaComoNumero(ajustes.cargaMaximaAgronomo),
        };
    }
}
