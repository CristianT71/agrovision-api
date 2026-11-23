import { Controller, Get, Headers, Inject, Param, Res, UseFilters } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Response } from "express";
import { pipeline } from "node:stream/promises";
import { LEER_MEDIO_VUELO, type ILeerMedioVuelo } from "../../../../domain/ports/in/medios.port";
import { VuelosExceptionFilter } from "./vuelos-exception.filter";

@Controller("vuelos/medios")
@UseFilters(VuelosExceptionFilter)
export class MediosVuelosController {
    constructor(@Inject(LEER_MEDIO_VUELO) private readonly leer: ILeerMedioVuelo) {}
    @Get(":token")
    @Throttle({ publico: { limit: 1200, ttl: 60_000 } })
    async obtener(@Param("token") token: string, @Headers("range") range: string | undefined, @Res() res: Response) {
        // También en respuestas de error: nunca se permite cachear un medio privado.
        res.set({
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, no-store",
            "Accept-Ranges": "bytes",
        });
        const medio = await this.leer.ejecutar(token, range);
        res.status(medio.parcial ? 206 : 200).set({
            "Content-Type": medio.mime,
            "Content-Length": String(medio.parcial ? medio.fin - medio.inicio + 1 : medio.tamano),
            "Content-Disposition": `${medio.inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(medio.nombre).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16)}`)}`,
        });
        if (medio.parcial) res.set("Content-Range", `bytes ${medio.inicio}-${medio.fin}/${medio.tamano}`);
        try {
            await pipeline(medio.flujo, res);
        } catch {
            if (!res.destroyed) res.destroy();
        }
    }
}
