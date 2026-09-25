import { Controller, Get, Param, ParseUUIDPipe, Patch, Query, StreamableFile, UseGuards } from "@nestjs/common";
import { ListarAgronomosService } from "../../../../application/use-cases/listar-agronomos.service";
import { ObtenerAgronomoService } from "../../../../application/use-cases/obtener-agronomo.service";
import { CambiarEstadoAgronomoService } from "../../../../application/use-cases/cambiar-estado-agronomo.service";
import { DescargarDocumentoAgronomoService } from "../../../../application/use-cases/descargar-documento-agronomo.service";
import { ConsultarAgronomosDto } from "./dto/consultar-agronomos.dto";
import { JwtAuthGuard } from "../../../../../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../../../../../common/guards/roles.guard";
import { Roles } from "../../../../../../common/decorators/roles.decorator";
import { UsuarioActual } from "../../../../../../common/decorators/usuario-actual.decorator";

// Módulo de identidades operativas del Administrador (RF-10.1)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
@Controller("agronomos")
export class AgronomosController {
    constructor(
        private readonly listarAgronomosService: ListarAgronomosService,
        private readonly obtenerAgronomoService: ObtenerAgronomoService,
        private readonly cambiarEstadoAgronomoService: CambiarEstadoAgronomoService,
        private readonly descargarDocumentoService: DescargarDocumentoAgronomoService,
    ) {}

    @Get()
    async listar(@Query() filtros: ConsultarAgronomosDto) {
        return await this.listarAgronomosService.ejecutar(filtros);
    }

    // Perfil del agrónomo autenticado. Va antes de ":id" para que "me" no se tome como id
    @Get("me")
    @Roles("agronomo")
    async miPerfil(@UsuarioActual("id") usuarioId: string) {
        return await this.obtenerAgronomoService.ejecutar({ usuarioId });
    }

    @Get(":id")
    async obtenerPorId(@Param("id", ParseUUIDPipe) id: string) {
        return await this.obtenerAgronomoService.ejecutar({ id });
    }

    @Get(":id/documentos/:documentoId")
    async descargarDocumento(
        @Param("id", ParseUUIDPipe) agronomoId: string,
        @Param("documentoId", ParseUUIDPipe) documentoId: string,
    ) {
        const { documento, contenido } = await this.descargarDocumentoService.ejecutar({ agronomoId, documentoId });

        return new StreamableFile(contenido, {
            type: documento.tipoMime,
            // El nombre original se codifica: nunca se inyecta tal cual en la cabecera
            disposition: `attachment; filename*=UTF-8''${encodeURIComponent(documento.nombreOriginal)}`,
        });
    }

    // RF-10.5: solo la validación humana libera al agrónomo pendiente
    @Patch(":id/validar")
    async validar(@Param("id", ParseUUIDPipe) agronomoId: string) {
        return await this.cambiarEstadoAgronomoService.ejecutar({ agronomoId, accion: "validar" });
    }

    @Patch(":id/desactivar")
    async desactivar(@Param("id", ParseUUIDPipe) agronomoId: string) {
        return await this.cambiarEstadoAgronomoService.ejecutar({ agronomoId, accion: "desactivar" });
    }

    @Patch(":id/reactivar")
    async reactivar(@Param("id", ParseUUIDPipe) agronomoId: string) {
        return await this.cambiarEstadoAgronomoService.ejecutar({ agronomoId, accion: "reactivar" });
    }
}
