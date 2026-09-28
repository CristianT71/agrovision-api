import { Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, UseGuards } from "@nestjs/common";
import { ObtenerPermisoContactoService } from "../../../../application/use-cases/obtener-permiso-contacto.service";
import { OtorgarPermisoContactoService } from "../../../../application/use-cases/otorgar-permiso-contacto.service";
import { RevocarPermisoContactoService } from "../../../../application/use-cases/revocar-permiso-contacto.service";
import { JwtAuthGuard } from "../../../../../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../../../../../common/guards/roles.guard";
import { Roles } from "../../../../../../common/decorators/roles.decorator";
import { UsuarioActual, type UsuarioAutenticado } from "../../../../../../common/decorators/usuario-actual.decorator";

// Control de acceso al contacto directo productor-evaluador por solicitud (RF-04.10, RF-08.8).
// Las rutas cuelgan de la solicitud a la que pertenece el permiso.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin", "agronomo")
@Controller("solicitudes/:solicitudId/permiso-contacto")
export class PermisosContactoController {
    constructor(
        private readonly obtenerPermisoContactoService: ObtenerPermisoContactoService,
        private readonly otorgarPermisoContactoService: OtorgarPermisoContactoService,
        private readonly revocarPermisoContactoService: RevocarPermisoContactoService,
    ) {}

    // El agrónomo asignado consulta si ya puede contactar al productor
    @Get()
    async obtener(
        @Param("solicitudId", ParseUUIDPipe) solicitudId: string,
        @UsuarioActual() usuario: UsuarioAutenticado,
    ) {
        return await this.obtenerPermisoContactoService.ejecutar({
            actor: { usuarioId: usuario.id, rol: usuario.rol },
            solicitudId,
        });
    }

    // RF-08.8: solo el Administrador otorga o extingue el permiso
    @Patch("otorgar")
    @Roles("admin")
    @HttpCode(HttpStatus.OK)
    async otorgar(
        @Param("solicitudId", ParseUUIDPipe) solicitudId: string,
        @UsuarioActual("id") adminUsuarioId: string,
    ) {
        const permiso = await this.otorgarPermisoContactoService.ejecutar({ adminUsuarioId, solicitudId });

        return {
            message: "Permiso de contacto otorgado exitosamente.",
            permiso,
        };
    }

    @Patch("revocar")
    @Roles("admin")
    @HttpCode(HttpStatus.OK)
    async revocar(
        @Param("solicitudId", ParseUUIDPipe) solicitudId: string,
        @UsuarioActual("id") adminUsuarioId: string,
    ) {
        const permiso = await this.revocarPermisoContactoService.ejecutar({ adminUsuarioId, solicitudId });

        return {
            message: "Permiso de contacto revocado exitosamente.",
            permiso,
        };
    }
}
