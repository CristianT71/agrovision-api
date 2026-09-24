import {
    BadRequestException,
    Body,
    Controller,
    Get,
    Param,
    ParseUUIDPipe,
    Patch,
    Post,
    Query,
    UploadedFile,
    UseGuards,
    UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ListarPlagasService } from "../../../../application/use-cases/listar-plagas.service";
import { ObtenerPlagaService } from "../../../../application/use-cases/obtener-plaga.service";
import { CrearPlagaService } from "../../../../application/use-cases/crear-plaga.service";
import { ActualizarPlagaService } from "../../../../application/use-cases/actualizar-plaga.service";
import { AvalarPlagaService } from "../../../../application/use-cases/avalar-plaga.service";
import { ActualizarProtocoloQuimicoService } from "../../../../application/use-cases/actualizar-protocolo-quimico.service";
import { SubirFotoPlagaService } from "../../../../application/use-cases/subir-foto-plaga.service";
import { ActualizarPlagaDto, ActualizarProtocoloQuimicoDto, ConsultarPlagasDto, CrearPlagaDto } from "./dto/plagas.dto";
import { JwtAuthGuard } from "../../../../../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../../../../../common/guards/roles.guard";
import { Roles } from "../../../../../../common/decorators/roles.decorator";
import { UsuarioActual } from "../../../../../../common/decorators/usuario-actual.decorator";
import {
    TIPOS_IMAGEN,
    validarArchivo,
    type ArchivoSubido,
} from "../../../../../../common/almacenamiento/validar-archivo";

const MAX_BYTES_FOTO = 3 * 1024 * 1024;

// El catálogo es un módulo del Profesional (RF-02.2). El administrador puede consultarlo
// al revisar casos, pero solo el agrónomo lo modifica.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("agronomo")
@Controller("plagas")
export class PlagasController {
    constructor(
        private readonly listarPlagasService: ListarPlagasService,
        private readonly obtenerPlagaService: ObtenerPlagaService,
        private readonly crearPlagaService: CrearPlagaService,
        private readonly actualizarPlagaService: ActualizarPlagaService,
        private readonly avalarPlagaService: AvalarPlagaService,
        private readonly actualizarProtocoloService: ActualizarProtocoloQuimicoService,
        private readonly subirFotoService: SubirFotoPlagaService,
    ) {}

    @Get()
    @Roles("agronomo", "admin")
    async listar(@Query() filtros: ConsultarPlagasDto) {
        return await this.listarPlagasService.ejecutar(filtros);
    }

    @Get(":id")
    @Roles("agronomo", "admin")
    async obtenerPorId(@Param("id", ParseUUIDPipe) id: string) {
        return await this.obtenerPlagaService.ejecutar(id);
    }

    @Post()
    async crear(@Body() dto: CrearPlagaDto) {
        return await this.crearPlagaService.ejecutar(dto);
    }

    @Patch(":id")
    async actualizar(@Param("id", ParseUUIDPipe) id: string, @Body() dto: ActualizarPlagaDto) {
        return await this.actualizarPlagaService.ejecutar(id, dto);
    }

    // RF-05.7: la firma del agrónomo autenticado libera el protocolo químico
    @Post(":id/avales")
    async avalar(@Param("id", ParseUUIDPipe) plagaId: string, @UsuarioActual("id") usuarioId: string) {
        return await this.avalarPlagaService.ejecutar({ plagaId, usuarioId });
    }

    @Patch(":id/protocolo-quimico")
    async actualizarProtocolo(@Param("id", ParseUUIDPipe) plagaId: string, @Body() dto: ActualizarProtocoloQuimicoDto) {
        return await this.actualizarProtocoloService.ejecutar({ plagaId, protocoloQuimico: dto.protocoloQuimico });
    }

    @Post(":id/foto")
    @UseInterceptors(FileInterceptor("foto", { limits: { fileSize: MAX_BYTES_FOTO, files: 1 } }))
    async subirFoto(@Param("id", ParseUUIDPipe) plagaId: string, @UploadedFile() archivo: ArchivoSubido | undefined) {
        if (!archivo) {
            throw new BadRequestException("Debes adjuntar una imagen en el campo 'foto'.");
        }

        const foto = validarArchivo(archivo, { tiposPermitidos: TIPOS_IMAGEN, maxBytes: MAX_BYTES_FOTO });

        return await this.subirFotoService.ejecutar({ plagaId, archivo: foto });
    }
}
