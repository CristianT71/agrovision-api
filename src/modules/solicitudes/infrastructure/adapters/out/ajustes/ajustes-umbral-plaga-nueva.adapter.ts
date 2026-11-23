import { Injectable } from "@nestjs/common";
import type { IUmbralPlagaNueva } from "../../../../domain/ports/out/umbral-plaga-nueva.port";
import { AjustesService } from "../../../../../ajustes/application/use-cases/ajustes.service";
import { umbralPlagaComoNumero } from "../../../../../ajustes/domain/ajustes";

@Injectable()
export class AjustesUmbralPlagaNuevaAdapter implements IUmbralPlagaNueva {
    constructor(private readonly ajustesService: AjustesService) {}

    async obtener(): Promise<number> {
        const ajustes = await this.ajustesService.obtenerSistema();
        return umbralPlagaComoNumero(ajustes.umbralPlagaNueva);
    }
}
