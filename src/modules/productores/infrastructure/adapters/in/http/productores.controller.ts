import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { CompletarPerfilProductorService } from "../../../../application/use-cases/completar-perfil-productor.service";
import { ListarProductoresService } from "../../../../application/use-cases/listar-productores.service";
import { ObtenerProductorService } from "../../../../application/use-cases/obtener-productor.service";
import { ValidarProductorService } from "../../../../application/use-cases/validar-productor.service";
import { ConsentimientoProductorService } from "../../../../application/use-cases/consentimiento-productor.service";
import { CompletarPerfilProductorDto, ConsultarProductoresDto, RevocarConsentimientoDto } from "./dto/productores.dto";
import { JwtAuthGuard } from "../../../../../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../../../../../common/guards/roles.guard";
import { Roles } from "../../../../../../common/decorators/roles.decorator";
import { UsuarioActual, type UsuarioAutenticado } from "../../../../../../common/decorators/usuario-actual.decorator";

// Módulo de identidades originadoras (RF-10.1). Las rutas "me" son del propio productor
// (app móvil) y van antes de ":id" para que "me" no se tome como id.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
@Controller("productores")
export class ProductoresController {
    constructor(
        private readonly completarPerfilService: CompletarPerfilProductorService,
        private readonly listarProductoresService: ListarProductoresService,
        private readonly obtenerProductorService: ObtenerProductorService,
        private readonly validarProductorService: ValidarProductorService,
        private readonly consentimientoService: ConsentimientoProductorService,
    ) {}

    @Post("me")
    @Roles("productor")
    async completarPerfil(@Body() dto: CompletarPerfilProductorDto, @UsuarioActual() usuario: UsuarioAutenticado) {
        return await this.completarPerfilService.ejecutar({
            ...dto,
            usuarioId: usuario.id,
            telefono: usuario.telefono,
        });
    }

    @Get("me")
    @Roles("productor")
    async miPerfil(@UsuarioActual("id") usuarioId: string) {
        return await this.obtenerProductorService.ejecutar({ usuarioId });
    }

    @Patch("me/consentimiento/otorgar")
    @Roles("productor")
    async otorgarMiConsentimiento(@UsuarioActual("id") usuarioId: string) {
        return await this.consentimientoService.otorgar({ usuarioId });
    }

    @Patch("me/consentimiento/revocar")
    @Roles("productor")
    async revocarMiConsentimiento(@UsuarioActual("id") usuarioId: string, @Body() dto: RevocarConsentimientoDto) {
        return await this.consentimientoService.revocar({ usuarioId }, dto.confirmacion);
    }

    @Get()
    async listar(@Query() filtros: ConsultarProductoresDto) {
        return await this.listarProductoresService.ejecutar(filtros);
    }

    // RF-10.2: el detalle expone el estado del consentimiento para decidir el uso de sus fotos
    @Get(":id")
    async obtenerPorId(@Param("id", ParseUUIDPipe) id: string) {
        return await this.obtenerProductorService.ejecutar({ id });
    }

    @Patch(":id/validar")
    async validar(@Param("id", ParseUUIDPipe) id: string) {
        return await this.validarProductorService.ejecutar(id);
    }

    @Patch(":id/consentimiento/revocar")
    async revocarConsentimiento(@Param("id", ParseUUIDPipe) id: string, @Body() dto: RevocarConsentimientoDto) {
        return await this.consentimientoService.revocar({ id }, dto.confirmacion);
    }
}
