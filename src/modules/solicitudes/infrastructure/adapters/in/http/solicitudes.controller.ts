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
    StreamableFile,
    UploadedFiles,
    UseGuards,
    UseInterceptors,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { ResolverSolicitudService } from "../../../../application/use-cases/resolver-solicitud.service";
import { ListarSolicitudesService } from "../../../../application/use-cases/listar-solicitudes.service";
import { ObtenerSolicitudPorIdService } from "../../../../application/use-cases/obtener-solicitud-por-id.service";
import { AsignarSolicitudService } from "../../../../application/use-cases/asignar-solicitud.service";
import { ListarFotosSolicitudService } from "../../../../application/use-cases/listar-fotos-solicitud.service";
import { DescargarFotoSolicitudService } from "../../../../application/use-cases/descargar-foto-solicitud.service";
import { AnexosResolucionService } from "../../../../application/use-cases/anexos-resolucion.service";
import { MAX_ANEXOS_RESOLUCION } from "../../../../domain/entities/anexo-resolucion.entity";
import {
    TIPOS_DOCUMENTO,
    validarArchivo,
    type ArchivoSubido,
} from "../../../../../../common/almacenamiento/validar-archivo";
import { ResolverSolicitudDto } from "./dto/resolver-solicitud.dto";
import { AsignarSolicitudDto } from "./dto/asignar-solicitud.dto";
import { ConsultarSolicitudesDto } from "./consultar-solicitudes.dto";
import { JwtAuthGuard } from "../../../../../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../../../../../common/guards/roles.guard";
import { Roles } from "../../../../../../common/decorators/roles.decorator";
import { UsuarioActual, type UsuarioAutenticado } from "../../../../../../common/decorators/usuario-actual.decorator";

const MAX_BYTES_ANEXO = 10 * 1024 * 1024;

const EXTENSIONES_FOTO: Record<string, string> = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };

// El panel solo lo usan agrónomos y administradores (RF-02.2, RF-02.3)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("agronomo", "admin")
@Controller("solicitudes")
export class SolicitudesController {
    constructor(
        private readonly resolverSolicitudService: ResolverSolicitudService,
        private readonly listarSolicitudesService: ListarSolicitudesService,
        private readonly obtenerSolicitudPorIdService: ObtenerSolicitudPorIdService,
        private readonly asignarSolicitudService: AsignarSolicitudService,
        private readonly listarFotosSolicitudService: ListarFotosSolicitudService,
        private readonly descargarFotoSolicitudService: DescargarFotoSolicitudService,
        private readonly anexosResolucionService: AnexosResolucionService,
    ) {}

    @Get()
    async listar(@Query() filtros: ConsultarSolicitudesDto, @UsuarioActual() usuario: UsuarioAutenticado) {
        return await this.listarSolicitudesService.ejecutar({ ...filtros, usuario });
    }

    // Fotos que subió la app móvil. Declaradas antes de ":id" para que ninguna ruta las capture.
    @Get(":id/fotos")
    async listarFotos(@Param("id", ParseUUIDPipe) id: string) {
        return await this.listarFotosSolicitudService.ejecutar(id);
    }

    @Get(":id/fotos/:fotoId")
    async descargarFoto(@Param("id", ParseUUIDPipe) id: string, @Param("fotoId", ParseUUIDPipe) fotoId: string) {
        const { foto, contenido } = await this.descargarFotoSolicitudService.ejecutar({ solicitudId: id, fotoId });

        // El nombre lo arma el servidor: la ruta interna nunca se expone
        return new StreamableFile(contenido, {
            type: foto.tipoMime ?? "application/octet-stream",
            disposition: `attachment; filename="foto-${foto.orden}${EXTENSIONES_FOTO[foto.tipoMime ?? ""] ?? ""}"`,
        });
    }

    // RF-04.6: anexos de la resolución. También antes de ":id".
    @Get(":id/anexos")
    async listarAnexos(@Param("id", ParseUUIDPipe) id: string) {
        return await this.anexosResolucionService.listar(id);
    }

    @Get(":id/anexos/:anexoId")
    async descargarAnexo(@Param("id", ParseUUIDPipe) id: string, @Param("anexoId", ParseUUIDPipe) anexoId: string) {
        const { anexo, contenido } = await this.anexosResolucionService.descargar(id, anexoId);

        return new StreamableFile(contenido, {
            type: anexo.tipoMime,
            // El nombre original se codifica: nunca se inyecta tal cual en la cabecera
            disposition: `attachment; filename*=UTF-8''${encodeURIComponent(anexo.nombreOriginal)}`,
        });
    }

    @Get(":id")
    async obtenerPorId(@Param("id", ParseUUIDPipe) id: string) {
        return await this.obtenerSolicitudPorIdService.ejecutar(id);
    }

    // Resolver es tarea del Profesional; el Administrador coordina y asigna (RF-08)
    // Acepta JSON (sin anexos) o multipart/form-data con los anexos en el campo "anexos" (RF-04.6)
    @Patch(":id/resolver")
    @Roles("agronomo")
    @HttpCode(HttpStatus.OK)
    @UseInterceptors(
        FilesInterceptor("anexos", MAX_ANEXOS_RESOLUCION, {
            limits: { fileSize: MAX_BYTES_ANEXO, files: MAX_ANEXOS_RESOLUCION },
        }),
    )
    async resolver(
        @Param("id", ParseUUIDPipe) id: string,
        @Body() dto: ResolverSolicitudDto,
        @UsuarioActual("id") usuarioId: string,
        @UploadedFiles() archivos: ArchivoSubido[] | undefined,
    ) {
        // Imágenes o PDF, verificados por su contenido real y no por la extensión
        const anexos = (archivos ?? []).map((archivo) =>
            validarArchivo(archivo, { tiposPermitidos: TIPOS_DOCUMENTO, maxBytes: MAX_BYTES_ANEXO }),
        );

        await this.resolverSolicitudService.ejecutar({
            solicitudId: id,
            usuarioId,
            respuestaProfesional: dto.respuestaProfesional,
            tipoResultado: dto.tipoResultado,
            plagaIdentificada: dto.plagaIdentificada,
            anexos,
        });

        return {
            message: "Solicitud resuelta y conmutada a solo lectura exitosamente.",
        };
    }

    // El Administrador delega el caso a un agrónomo activo (RF-08.3)
    @Patch(":id/asignar")
    @Roles("admin")
    @HttpCode(HttpStatus.OK)
    async asignar(@Param("id", ParseUUIDPipe) id: string, @Body() dto: AsignarSolicitudDto) {
        const solicitud = await this.asignarSolicitudService.ejecutar({
            solicitudId: id,
            agronomoId: dto.agronomoId,
        });

        return {
            message: "Solicitud asignada exitosamente.",
            solicitud,
        };
    }
}
