import {
    Body,
    Controller,
    Get,
    HttpCode,
    Inject,
    Param,
    ParseUUIDPipe,
    Post,
    Query,
    Res,
    StreamableFile,
    UseFilters,
    UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { Throttle } from "@nestjs/throttler";
import { JwtAuthGuard } from "../../../../../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../../../../../common/guards/roles.guard";
import { Roles } from "../../../../../../common/decorators/roles.decorator";
import { ASISTENTE_VUELOS, type IAsistenteVuelos } from "../../../../domain/ports/in/asistente-vuelos.port";
import { ConsultarInformeDto, MensajeAsistenteDto } from "./dto/asistente.dto";
import { VuelosExceptionFilter } from "./vuelos-exception.filter";

// Puerta del panel al asistente de n8n. Mismo acceso que el resto de vuelos (solo admin con sesión) y un
// límite propio por cuenta, porque cada mensaje gasta créditos del modelo de IA.
@Controller("vuelos")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
@UseFilters(VuelosExceptionFilter)
export class AsistenteVuelosController {
    constructor(@Inject(ASISTENTE_VUELOS) private readonly asistente: IAsistenteVuelos) {}

    @Post(":id/chat")
    @HttpCode(200)
    @Throttle({ usuario: { limit: 10, ttl: 60_000 } })
    chat(@Param("id", ParseUUIDPipe) id: string, @Body() dto: MensajeAsistenteDto) {
        return this.asistente.conversar(id, dto.sessionId, dto.chatInput.trim());
    }

    @Get(":id/informe")
    @Throttle({ usuario: { limit: 30, ttl: 60_000 } })
    async informe(
        @Param("id", ParseUUIDPipe) id: string,
        @Query() dto: ConsultarInformeDto,
        @Res({ passthrough: true }) res: Response,
    ) {
        const { contenido } = await this.asistente.descargarInforme(id, dto.t.replace(/\.pdf$/i, ""));
        res.set({ "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });
        return new StreamableFile(contenido, {
            type: "application/pdf",
            disposition: 'attachment; filename="informe-agrovision.pdf"',
            length: contenido.length,
        });
    }
}
