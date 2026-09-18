import {
    Controller,
    Patch,
    Get,
    Param,
    Body,
    Query,
    HttpCode,
    HttpStatus,
    ParseUUIDPipe,
    UseGuards,
} from "@nestjs/common";
import { ResolverSolicitudService } from "../../../../application/use-cases/resolver-solicitud.service";
import { ListarSolicitudesService } from "../../../../application/use-cases/listar-solicitudes.service";
import { ObtenerSolicitudPorIdService } from "../../../../application/use-cases/obtener-solicitud-por-id.service";
import { ResolverSolicitudDto } from "./dto/resolver-solicitud.dto";
import { ConsultarSolicitudesDto } from "./consultar-solicitudes.dto";
import { JwtAuthGuard } from "src/common/guards/jwt-auth.guard";

@UseGuards(JwtAuthGuard)
@Controller("solicitudes")
export class SolicitudesController {
    constructor(
        private readonly resolverSolicitudService: ResolverSolicitudService,
        private readonly listarSolicitudesService: ListarSolicitudesService,
        private readonly obtenerSolicitudPorIdService: ObtenerSolicitudPorIdService,
    ) {}

    @Get()
    async listar(@Query() filtros: ConsultarSolicitudesDto) {
        return await this.listarSolicitudesService.ejecutar(filtros);
    }

    @Get(":id")
    async obtenerPorId(@Param("id", ParseUUIDPipe) id: string) {
        return await this.obtenerSolicitudPorIdService.ejecutar(id);
    }

    @Patch(":id/resolver")
    @HttpCode(HttpStatus.OK)
    async resolver(@Param("id", ParseUUIDPipe) id: string, @Body() dto: ResolverSolicitudDto) {
        await this.resolverSolicitudService.ejecutar({
            solicitudId: id,
            respuestaProfesional: dto.respuestaProfesional,
            tipoResultado: dto.tipoResultado,
        });

        return {
            message: "Solicitud resuelta y conmutada a solo lectura exitosamente.",
        };
    }
}
