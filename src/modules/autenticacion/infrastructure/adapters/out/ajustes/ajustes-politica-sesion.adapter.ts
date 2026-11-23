import { Injectable } from "@nestjs/common";
import type { IPoliticaSesion } from "../../../../domain/ports/out/politica-sesion.port";
import { AjustesService } from "../../../../../ajustes/application/use-cases/ajustes.service";
import { minutosDeExpiracion } from "../../../../../ajustes/domain/ajustes";

// Se consulta en cada petición autenticada del panel: se recuerda unos segundos para no leer la base cada vez.
// Un cambio en Ajustes se aplica en este tiempo.
export const SEGUNDOS_EN_MEMORIA = 30;

@Injectable()
export class AjustesPoliticaSesionAdapter implements IPoliticaSesion {
    private recordado: { minutos: number; hasta: number } | null = null;

    constructor(private readonly ajustesService: AjustesService) {}

    async minutosInactividadPanel(): Promise<number> {
        const ahora = Date.now();
        if (this.recordado && ahora < this.recordado.hasta) return this.recordado.minutos;

        const { expiracionSesion } = await this.ajustesService.obtenerSistema();
        const minutos = minutosDeExpiracion(expiracionSesion);
        this.recordado = { minutos, hasta: ahora + SEGUNDOS_EN_MEMORIA * 1000 };
        return minutos;
    }
}
