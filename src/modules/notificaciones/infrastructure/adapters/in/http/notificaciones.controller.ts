import { Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Query, UseGuards } from "@nestjs/common";
import { ListarNotificacionesService } from "../../../../application/use-cases/listar-notificaciones.service";
import { ContarNoLeidasService } from "../../../../application/use-cases/contar-no-leidas.service";
import { MarcarNotificacionLeidaService } from "../../../../application/use-cases/marcar-notificacion-leida.service";
import { MarcarTodasLeidasService } from "../../../../application/use-cases/marcar-todas-leidas.service";
import { ConsultarNotificacionesDto } from "./dto/notificaciones.dto";
import { JwtAuthGuard } from "../../../../../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../../../../../common/guards/roles.guard";
import { Roles } from "../../../../../../common/decorators/roles.decorator";
import { UsuarioActual } from "../../../../../../common/decorators/usuario-actual.decorator";

// La campana es de cada quien: no hay endpoint para crear notificaciones, solo las
// genera el sistema desde otros módulos (RF-02.5).
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin", "agronomo", "productor")
@Controller("notificaciones")
export class NotificacionesController {
    constructor(
        private readonly listarNotificacionesService: ListarNotificacionesService,
        private readonly contarNoLeidasService: ContarNoLeidasService,
        private readonly marcarNotificacionLeidaService: MarcarNotificacionLeidaService,
        private readonly marcarTodasLeidasService: MarcarTodasLeidasService,
    ) {}

    @Get()
    async listar(@Query() consulta: ConsultarNotificacionesDto, @UsuarioActual("id") usuarioId: string) {
        return await this.listarNotificacionesService.ejecutar({
            usuarioId,
            soloNoLeidas: consulta.soloNoLeidas,
            pagina: consulta.pagina,
            limite: consulta.limite,
        });
    }

    // Contador que el frontend consulta periódicamente (tiempo real queda fuera por ahora)
    @Get("no-leidas")
    async contarNoLeidas(@UsuarioActual("id") usuarioId: string) {
        return await this.contarNoLeidasService.ejecutar({ usuarioId });
    }

    // Las rutas fijas van antes de las que llevan :id
    @Patch("leidas")
    @HttpCode(HttpStatus.OK)
    async marcarTodasLeidas(@UsuarioActual("id") usuarioId: string) {
        return await this.marcarTodasLeidasService.ejecutar({ usuarioId });
    }

    @Patch(":id/leida")
    @HttpCode(HttpStatus.OK)
    async marcarLeida(@Param("id", ParseUUIDPipe) id: string, @UsuarioActual("id") usuarioId: string) {
        return await this.marcarNotificacionLeidaService.ejecutar({ usuarioId, notificacionId: id });
    }
}
