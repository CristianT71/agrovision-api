import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    Inject,
    Param,
    ParseUUIDPipe,
    Patch,
    Post,
    Query,
    Res,
    UploadedFile,
    UseFilters,
    UseGuards,
    UseInterceptors,
    UnprocessableEntityException,
} from "@nestjs/common";
import type { Response } from "express";
import { Throttle } from "@nestjs/throttler";
import { JwtAuthGuard } from "../../../../../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../../../../../common/guards/roles.guard";
import { Roles } from "../../../../../../common/decorators/roles.decorator";
import { UsuarioActual } from "../../../../../../common/decorators/usuario-actual.decorator";
import { GESTION_VUELOS, type IGestionVuelos } from "../../../../domain/ports/in/vuelos.port";
import type { ArchivoRecibido } from "../../../../domain/entities/vuelo";
import { CrearVueloDto, ActualizarVueloDto, ConsultarVuelosDto, ConsultarArchivosDto } from "./dto/vuelos.dto";
import { SubidaVueloInterceptor } from "./subida-vuelo.interceptor";
import { VueloExistenteGuard } from "./guards/vuelo-existente.guard";
import { VuelosExceptionFilter } from "./vuelos-exception.filter";

@Controller("vuelos")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
@UseFilters(VuelosExceptionFilter)
export class VuelosController {
    constructor(@Inject(GESTION_VUELOS) private readonly gestion: IGestionVuelos) {}
    @Post() crear(@Body() dto: CrearVueloDto, @UsuarioActual("id") actor: string) {
        return this.gestion.crear(actor, { nombre: dto.nombre, lote: dto.lote ?? null, notas: dto.notas ?? null });
    }
    @Get() listar(@Query() dto: ConsultarVuelosDto) {
        return this.gestion.listar(dto);
    }
    @Get(":id") obtener(@Param("id", ParseUUIDPipe) id: string) {
        return this.gestion.obtener(id);
    }
    @Patch(":id") actualizar(@Param("id", ParseUUIDPipe) id: string, @Body() dto: ActualizarVueloDto) {
        return this.gestion.actualizar(id, dto);
    }
    @Delete(":id") @HttpCode(204) eliminar(@Param("id", ParseUUIDPipe) id: string, @UsuarioActual("id") actor: string) {
        return this.gestion.eliminar(id, actor);
    }
    // Límite propio: 1200 subidas/minuto por cuenta frente a las 240 peticiones/minuto globales.
    @Post(":id/archivos")
    @Throttle({ usuario: { limit: 1200, ttl: 60_000 } })
    @UseGuards(VueloExistenteGuard)
    @UseInterceptors(SubidaVueloInterceptor)
    async subir(
        @Param("id", ParseUUIDPipe) id: string,
        @UploadedFile() file: ArchivoRecibido | undefined,
        @Res({ passthrough: true }) res: Response,
    ) {
        if (!file) throw new UnprocessableEntityException("Falta el archivo en el campo archivo.");
        const resultado = await this.gestion.subir(id, file);
        res.status(resultado.duplicado ? 200 : 201);
        return resultado.archivo;
    }
    @Get(":id/archivos") archivos(@Param("id", ParseUUIDPipe) id: string, @Query() dto: ConsultarArchivosDto) {
        return this.gestion.listarArchivos(id, dto);
    }
    @Get(":id/archivos/:archivoId") archivo(
        @Param("id", ParseUUIDPipe) id: string,
        @Param("archivoId", ParseUUIDPipe) archivoId: string,
    ) {
        return this.gestion.obtenerArchivo(id, archivoId);
    }
    @Post(":id/archivos/:archivoId/enlace") @HttpCode(200) enlace(
        @Param("id", ParseUUIDPipe) id: string,
        @Param("archivoId", ParseUUIDPipe) archivoId: string,
        @UsuarioActual("id") actor: string,
    ) {
        return this.gestion.enlace(id, archivoId, actor);
    }
    @Get(":id/traza") traza(@Param("id", ParseUUIDPipe) id: string) {
        return this.gestion.traza(id);
    }
}
