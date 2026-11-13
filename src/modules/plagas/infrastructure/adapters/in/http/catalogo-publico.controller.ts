import { Controller, Get, Headers, HttpStatus, Query, Res } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Response } from "express";
import { SincronizarCatalogoService } from "../../../../application/use-cases/sincronizar-catalogo.service";
import { CatalogoSyncQueryDto } from "./dto/catalogo-sync.dto";

// Controlador separado del administrativo: público, sin JwtAuthGuard ni RolesGuard.
@Controller("public/v1/pests")
export class CatalogoPublicoController {
    constructor(private readonly sincronizar: SincronizarCatalogoService) {}

    @Get("sync")
    @Throttle({ publico: { limit: 60, ttl: 60_000 } })
    async sync(
        @Query() query: CatalogoSyncQueryDto,
        @Headers("if-none-match") ifNoneMatch: string | undefined,
        @Res({ passthrough: true }) res: Response,
    ) {
        const delta = await this.sincronizar.ejecutar(query.since === undefined ? undefined : Number(query.since));
        res.setHeader("ETag", delta.etag);
        res.setHeader("Cache-Control", "no-cache");
        if (
            ifNoneMatch?.split(",").some((tag) => tag.trim() === "*" || tag.trim().replace(/^W\//, "") === delta.etag)
        ) {
            res.status(HttpStatus.NOT_MODIFIED);
            return;
        }
        return delta;
    }
}
