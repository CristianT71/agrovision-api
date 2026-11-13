import { Controller, Get, Headers, HttpStatus, Inject, Query, Res } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Response } from "express";
import {
    REGLAS_ZONA_PUBLICAS,
    type IReglasZonaPublicas,
    type ReglaZonaPublica,
} from "../../../../domain/ports/in/reglas-zona.port";
import { ConsultaPublicaReglasZonaDto } from "./dto/reglas-zona.dto";

export function coincideEtag(ifNoneMatch: string | undefined, etag: string): boolean {
    return (
        ifNoneMatch?.split(",").some((tag) => tag.trim() === "*" || tag.trim().replace(/^W\//, "") === etag) ?? false
    );
}

// Controlador separado del administrativo: público, sin JwtAuthGuard ni RolesGuard.
// Solo entrega la regla activa sin ids internos ni datos del agrónomo.
@Controller("public/v1/zone-rules")
export class ReglasZonaPublicasController {
    constructor(@Inject(REGLAS_ZONA_PUBLICAS) private readonly publicas: IReglasZonaPublicas) {}

    @Get()
    @Throttle({ publico: { limit: 60, ttl: 60_000 } })
    async obtener(
        @Query() query: ConsultaPublicaReglasZonaDto,
        @Headers("if-none-match") ifNoneMatch: string | undefined,
        @Res({ passthrough: true }) res: Response,
    ): Promise<ReglaZonaPublica | undefined> {
        const resultado = await this.publicas.obtenerActiva(query.tipo);
        res.setHeader("Cache-Control", "no-cache");
        if (!resultado) {
            res.status(HttpStatus.NO_CONTENT);
            return undefined;
        }
        res.setHeader("ETag", resultado.etag);
        if (coincideEtag(ifNoneMatch, resultado.etag)) {
            res.status(HttpStatus.NOT_MODIFIED);
            return undefined;
        }
        return resultado.regla;
    }
}
