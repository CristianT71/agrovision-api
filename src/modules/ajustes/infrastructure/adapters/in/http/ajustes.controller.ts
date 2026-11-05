import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { minutosDeExpiracion } from "../../../../domain/ajustes";
import { AjustesService } from "../../../../application/use-cases/ajustes.service";
import { ActualizarAjustesPersonalesDto, ActualizarAjustesSistemaDto } from "./dto/ajustes.dto";
import { JwtAuthGuard } from "../../../../../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../../../../../common/guards/roles.guard";
import { Roles } from "../../../../../../common/decorators/roles.decorator";
import { UsuarioActual } from "../../../../../../common/decorators/usuario-actual.decorator";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("ajustes")
export class AjustesController {
    constructor(private readonly ajustesService: AjustesService) {}

    // Preferencias de la propia cuenta (idioma, zona horaria, avisos)
    @Roles("admin", "agronomo")
    @Get("mios")
    async obtenerMios(@UsuarioActual("id") usuarioId: string, @UsuarioActual("rol") rol: string) {
        return await this.ajustesService.obtenerPersonales(usuarioId, rol);
    }

    @Roles("admin", "agronomo")
    @Patch("mios")
    async guardarMios(
        @Body() dto: ActualizarAjustesPersonalesDto,
        @UsuarioActual("id") usuarioId: string,
        @UsuarioActual("rol") rol: string,
    ) {
        return await this.ajustesService.guardarPersonales(usuarioId, rol, dto);
    }

    // El panel necesita saber cuándo cerrar la sesión por inactividad; no es el ajuste completo, así que lo ve cualquier usuario del panel
    @Roles("admin", "agronomo")
    @Get("sesion")
    async obtenerSesion() {
        const { expiracionSesion } = await this.ajustesService.obtenerSistema();
        return { minutosInactividad: minutosDeExpiracion(expiracionSesion) };
    }

    // Configuración global de la plataforma: solo el administrador
    @Roles("admin")
    @Get("sistema")
    async obtenerSistema() {
        return await this.ajustesService.obtenerSistema();
    }

    @Roles("admin")
    @Patch("sistema")
    async guardarSistema(@Body() dto: ActualizarAjustesSistemaDto, @UsuarioActual("id") usuarioId: string) {
        return await this.ajustesService.guardarSistema(dto, usuarioId);
    }
}
