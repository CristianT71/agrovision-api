import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    ParseUUIDPipe,
    Patch,
    Post,
    StreamableFile,
    UploadedFiles,
    UseGuards,
    UseInterceptors,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { EnviarMensajeService } from "../../../../application/use-cases/enviar-mensaje.service";
import { ListarMensajesService } from "../../../../application/use-cases/listar-mensajes.service";
import { MarcarMensajesLeidosService } from "../../../../application/use-cases/marcar-mensajes-leidos.service";
import { ContarMensajesPendientesService } from "../../../../application/use-cases/contar-mensajes-pendientes.service";
import { DescargarAdjuntoMensajeService } from "../../../../application/use-cases/descargar-adjunto-mensaje.service";
import { MAX_ADJUNTOS_POR_MENSAJE } from "../../../../domain/entities/mensaje.entity";
import type { Actor } from "../../../../domain/ports/in/gestionar-mensajes.port";
import { EnviarMensajeDto } from "./dto/mensajes.dto";
import { JwtAuthGuard } from "../../../../../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../../../../../common/guards/roles.guard";
import { Roles } from "../../../../../../common/decorators/roles.decorator";
import { UsuarioActual, type UsuarioAutenticado } from "../../../../../../common/decorators/usuario-actual.decorator";
import {
    TIPOS_DOCUMENTO,
    validarArchivo,
    type ArchivoSubido,
} from "../../../../../../common/almacenamiento/validar-archivo";

const MAX_BYTES_ADJUNTO = 10 * 1024 * 1024;

// Canal de coordinación interno: el productor no participa (RF-04.9).
// Sin prefijo de controlador porque las rutas cuelgan de dos raíces (solicitudes y mensajes).
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin", "agronomo")
@Controller()
export class MensajesController {
    constructor(
        private readonly enviarMensajeService: EnviarMensajeService,
        private readonly listarMensajesService: ListarMensajesService,
        private readonly marcarMensajesLeidosService: MarcarMensajesLeidosService,
        private readonly contarMensajesPendientesService: ContarMensajesPendientesService,
        private readonly descargarAdjuntoService: DescargarAdjuntoMensajeService,
    ) {}

    // RF-08.6: contador que el frontend consulta periódicamente
    @Get("mensajes/pendientes")
    async contarPendientes(@UsuarioActual() usuario: UsuarioAutenticado) {
        return await this.contarMensajesPendientesService.ejecutar({ actor: this.aActor(usuario) });
    }

    @Get("solicitudes/:solicitudId/mensajes")
    async listar(
        @Param("solicitudId", ParseUUIDPipe) solicitudId: string,
        @UsuarioActual() usuario: UsuarioAutenticado,
    ) {
        return await this.listarMensajesService.ejecutar({ actor: this.aActor(usuario), solicitudId });
    }

    @Post("solicitudes/:solicitudId/mensajes")
    @HttpCode(HttpStatus.CREATED)
    @UseInterceptors(
        FilesInterceptor("adjuntos", MAX_ADJUNTOS_POR_MENSAJE, {
            limits: { fileSize: MAX_BYTES_ADJUNTO, files: MAX_ADJUNTOS_POR_MENSAJE },
        }),
    )
    async enviar(
        @Param("solicitudId", ParseUUIDPipe) solicitudId: string,
        @Body() dto: EnviarMensajeDto,
        @UploadedFiles() adjuntos: ArchivoSubido[] | undefined,
        @UsuarioActual() usuario: UsuarioAutenticado,
    ) {
        // RF-08.5: PDF o imagen, verificados por su contenido real
        const archivos = (adjuntos ?? []).map((archivo) =>
            validarArchivo(archivo, { tiposPermitidos: TIPOS_DOCUMENTO, maxBytes: MAX_BYTES_ADJUNTO }),
        );

        return await this.enviarMensajeService.ejecutar({
            actor: this.aActor(usuario),
            solicitudId,
            contenido: dto.contenido,
            archivos,
        });
    }

    @Patch("solicitudes/:solicitudId/mensajes/leidos")
    @HttpCode(HttpStatus.OK)
    async marcarLeidos(
        @Param("solicitudId", ParseUUIDPipe) solicitudId: string,
        @UsuarioActual() usuario: UsuarioAutenticado,
    ) {
        return await this.marcarMensajesLeidosService.ejecutar({ actor: this.aActor(usuario), solicitudId });
    }

    @Get("solicitudes/:solicitudId/mensajes/:mensajeId/adjuntos/:adjuntoId")
    async descargarAdjunto(
        @Param("solicitudId", ParseUUIDPipe) solicitudId: string,
        @Param("mensajeId", ParseUUIDPipe) mensajeId: string,
        @Param("adjuntoId", ParseUUIDPipe) adjuntoId: string,
        @UsuarioActual() usuario: UsuarioAutenticado,
    ) {
        const { adjunto, contenido } = await this.descargarAdjuntoService.ejecutar({
            actor: this.aActor(usuario),
            solicitudId,
            mensajeId,
            adjuntoId,
        });

        return new StreamableFile(contenido, {
            type: adjunto.tipoMime,
            // El nombre original se codifica: nunca se inyecta tal cual en la cabecera
            disposition: `attachment; filename*=UTF-8''${encodeURIComponent(adjunto.nombreArchivo)}`,
        });
    }

    private aActor(usuario: UsuarioAutenticado): Actor {
        return { usuarioId: usuario.id, rol: usuario.rol };
    }
}
