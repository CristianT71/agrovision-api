import {
    BadRequestException,
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    ParseUUIDPipe,
    Post,
    Query,
    UploadedFiles,
    UseGuards,
    UseInterceptors,
} from "@nestjs/common";
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import { SubirModeloService, MAX_BYTES_MODELO } from "../../../../application/use-cases/subir-modelo.service";
import { ListarModelosService } from "../../../../application/use-cases/listar-modelos.service";
import { ObtenerModeloService } from "../../../../application/use-cases/obtener-modelo.service";
import { ConsultarModelosDto, SubirModeloDto } from "./dto/modelos.dto";
import type { ArchivoSubido } from "../../../../../../common/almacenamiento/validar-archivo";
import { JwtAuthGuard } from "../../../../../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../../../../../common/guards/roles.guard";
import { Roles } from "../../../../../../common/decorators/roles.decorator";
import { UsuarioActual } from "../../../../../../common/decorators/usuario-actual.decorator";

interface ArchivosModelo {
    modelo?: ArchivoSubido[];
    etiquetas?: ArchivoSubido[];
    calibracion?: ArchivoSubido[];
}

// Orquestación de modelos IA: exclusivo del Administrador (RF-02.3, RF-09)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
@Controller("modelos")
export class ModelosController {
    constructor(
        private readonly subirModeloService: SubirModeloService,
        private readonly listarModelosService: ListarModelosService,
        private readonly obtenerModeloService: ObtenerModeloService,
    ) {}

    // RF-09.1: inventario con versión, canal y compatibilidad
    @Get()
    async listar(@Query() filtros: ConsultarModelosDto) {
        return await this.listarModelosService.ejecutar(filtros);
    }

    @Get(":id")
    async obtener(@Param("id", ParseUUIDPipe) id: string) {
        return await this.obtenerModeloService.ejecutar(id);
    }

    // RF-09.5: multipart con el modelo (.tflite o .pt) y, para .tflite, sus etiquetas y calibración
    @Post()
    @HttpCode(HttpStatus.CREATED)
    @UseInterceptors(
        FileFieldsInterceptor(
            [
                { name: "modelo", maxCount: 1 },
                { name: "etiquetas", maxCount: 1 },
                { name: "calibracion", maxCount: 1 },
            ],
            { limits: { fileSize: MAX_BYTES_MODELO, files: 3 } },
        ),
    )
    async subir(
        @Body() dto: SubirModeloDto,
        @UploadedFiles() archivos: ArchivosModelo | undefined,
        @UsuarioActual("id") adminUsuarioId: string,
    ) {
        const modelo = archivos?.modelo?.[0];
        if (!modelo) {
            throw new BadRequestException("Adjunta el archivo del modelo en el campo modelo.");
        }

        return await this.subirModeloService.ejecutar({
            ...dto,
            adminUsuarioId,
            modelo,
            etiquetas: archivos?.etiquetas?.[0],
            calibracion: archivos?.calibracion?.[0],
        });
    }
}
