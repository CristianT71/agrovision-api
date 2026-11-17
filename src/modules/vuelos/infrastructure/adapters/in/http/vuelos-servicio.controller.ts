import { Controller, Get, Inject, Param, ParseUUIDPipe, Query, UseFilters, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { GESTION_VUELOS, type IGestionVuelos } from "../../../../domain/ports/in/vuelos.port";
import { ConsultarArchivosDto, ConsultarVuelosDto } from "./dto/vuelos.dto";
import { LlaveServicioGuard } from "./guards/llave-servicio.guard";
import { VuelosExceptionFilter } from "./vuelos-exception.filter";

// Lectura de vuelos para la automatización de n8n, con llave de servicio en vez de sesión de usuario.
// SOLO consulta: no crea, cambia ni borra nada, y no entrega enlaces firmados a los archivos (los
// archivos los lee el servicio de índices directamente del disco). Las rutas de administrador
// (/vuelos) siguen exigiendo sesión. El @Throttle de clase marca la ruta como pública para el límite por IP.
@Controller("servicio/vuelos")
@UseGuards(LlaveServicioGuard)
@Throttle({ publico: { limit: 120, ttl: 60_000 } })
@UseFilters(VuelosExceptionFilter)
export class VuelosServicioController {
    constructor(@Inject(GESTION_VUELOS) private readonly gestion: IGestionVuelos) {}

    @Get() listar(@Query() dto: ConsultarVuelosDto) {
        return this.gestion.listar(dto);
    }

    @Get(":id") obtener(@Param("id", ParseUUIDPipe) id: string) {
        return this.gestion.obtener(id);
    }

    @Get(":id/archivos") archivos(@Param("id", ParseUUIDPipe) id: string, @Query() dto: ConsultarArchivosDto) {
        return this.gestion.listarArchivos(id, dto);
    }
}
