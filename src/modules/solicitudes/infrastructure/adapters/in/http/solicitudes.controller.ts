import { Controller, Patch, Param, Body, HttpCode, HttpStatus } from "@nestjs/common";
import { ResolverSolicitudService } from "../../../../application/use-cases/resolver-solicitud.service";
import { ResolverSolicitudDto } from "./dto/resolver-solicitud.dto";

@Controller("solicitudes")
export class SolicitudesController {
    constructor(private readonly resolverSolicitudService: ResolverSolicitudService) {}

    @Patch(":id/resolver")
    @HttpCode(HttpStatus.OK)
    async resolver(@Param("id") id: string, @Body() dto: ResolverSolicitudDto) {
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
