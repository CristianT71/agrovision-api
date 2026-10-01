import {
    BadRequestException,
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    ParseUUIDPipe,
    Patch,
    Post,
    Put,
    Query,
    UploadedFiles,
    UseGuards,
    UseInterceptors,
} from "@nestjs/common";
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import { SubirModeloService, MAX_BYTES_MODELO } from "../../../../application/use-cases/subir-modelo.service";
import { ListarModelosService } from "../../../../application/use-cases/listar-modelos.service";
import { ObtenerModeloService } from "../../../../application/use-cases/obtener-modelo.service";
import { RegistrarMetricasService } from "../../../../application/use-cases/registrar-metricas.service";
import { CambiarCanalService } from "../../../../application/use-cases/cambiar-canal.service";
import { ListarAuditoriaModeloService } from "../../../../application/use-cases/listar-auditoria-modelo.service";
import { ActivarKillSwitchService } from "../../../../application/use-cases/activar-kill-switch.service";
import {
    ActivarKillSwitchDto,
    CambiarCanalDto,
    ConsultarModelosDto,
    RegistrarMetricasDto,
    SubirModeloDto,
} from "./dto/modelos.dto";
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
        private readonly registrarMetricasService: RegistrarMetricasService,
        private readonly cambiarCanalService: CambiarCanalService,
        private readonly listarAuditoriaService: ListarAuditoriaModeloService,
        private readonly activarKillSwitchService: ActivarKillSwitchService,
    ) {}

    // RF-09.1: inventario con versión, canal y compatibilidad
    @Get()
    async listar(@Query() filtros: ConsultarModelosDto) {
        return await this.listarModelosService.ejecutar(filtros);
    }

    // RF-09.4: historial auditado del modelo. Antes de ":id" para que ninguna ruta lo capture.
    @Get(":id/auditoria")
    async auditoria(@Param("id", ParseUUIDPipe) id: string) {
        return await this.listarAuditoriaService.ejecutar(id);
    }

    @Get(":id")
    async obtener(@Param("id", ParseUUIDPipe) id: string) {
        return await this.obtenerModeloService.ejecutar(id);
    }

    // RF-09.2: reemplaza las métricas (global y por clase) mientras el modelo no esté publicado
    @Put(":id/metricas")
    async registrarMetricas(
        @Param("id", ParseUUIDPipe) id: string,
        @Body() dto: RegistrarMetricasDto,
        @UsuarioActual("id") adminUsuarioId: string,
    ) {
        return await this.registrarMetricasService.ejecutar({ modeloId: id, adminUsuarioId, ...dto });
    }

    // RF-09.5: avanza el modelo en el pipeline (o lo descontinúa). Al llegar a producción,
    // la versión que estaba vigente pasa a descontinuada en la misma operación.
    @Patch(":id/canal")
    @HttpCode(HttpStatus.OK)
    async cambiarCanal(
        @Param("id", ParseUUIDPipe) id: string,
        @Body() dto: CambiarCanalDto,
        @UsuarioActual("id") adminUsuarioId: string,
    ) {
        const resultado = await this.cambiarCanalService.ejecutar({ modeloId: id, adminUsuarioId, ...dto });

        return {
            message: `Modelo movido a ${resultado.modelo.canal} exitosamente.`,
            ...resultado,
        };
    }

    // RF-09.3: retiro de emergencia. Los teléfonos con esta versión vuelven a la anterior
    // en su próxima consulta del manifiesto, sin descargar nada.
    @Patch(":id/kill-switch")
    @HttpCode(HttpStatus.OK)
    async activarKillSwitch(
        @Param("id", ParseUUIDPipe) id: string,
        @Body() dto: ActivarKillSwitchDto,
        @UsuarioActual("id") adminUsuarioId: string,
    ) {
        const modelo = await this.activarKillSwitchService.ejecutar({ modeloId: id, adminUsuarioId, ...dto });

        return {
            message: "Kill-switch activado: la versión se retira de los dispositivos.",
            modelo,
        };
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
