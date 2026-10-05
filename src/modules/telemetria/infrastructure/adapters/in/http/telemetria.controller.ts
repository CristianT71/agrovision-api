import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../../../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../../../../../common/guards/roles.guard";
import { Roles } from "../../../../../../common/decorators/roles.decorator";
import { ResumirTelemetriaService } from "../../../../application/use-cases/resumir-telemetria.service";
import { ConsultarResumenTelemetriaDto } from "./dto/telemetria.dto";

// Indicadores de campo para el tablero del Administrador (RF-06)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
@Controller("telemetria")
export class TelemetriaController {
    constructor(private readonly resumirTelemetriaService: ResumirTelemetriaService) {}

    @Get("resumen")
    async resumen(@Query() consulta: ConsultarResumenTelemetriaDto) {
        return await this.resumirTelemetriaService.ejecutar(consulta);
    }
}
