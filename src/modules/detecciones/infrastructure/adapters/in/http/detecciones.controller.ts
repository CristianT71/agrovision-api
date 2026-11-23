import { Controller, Get, Param, ParseUUIDPipe, Query, StreamableFile, UseGuards } from "@nestjs/common";
import { ListarDeteccionesService } from "../../../../application/use-cases/listar-detecciones.service";
import { ListarMapaDeteccionesService } from "../../../../application/use-cases/listar-mapa-detecciones.service";
import { ObtenerKmlDeteccionService } from "../../../../application/use-cases/obtener-kml-deteccion.service";
import { ObtenerDeteccionService } from "../../../../application/use-cases/obtener-deteccion.service";
import { ResumirDeteccionesService } from "../../../../application/use-cases/resumir-detecciones.service";
import type { FiltrosDetecciones } from "../../../../domain/ports/out/lectura-detecciones.port";
import { ConsultarDeteccionesDto, ConsultarMapaDeteccionesDto, FiltrosDeteccionesDto } from "./dto/detecciones.dto";
import { JwtAuthGuard } from "../../../../../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../../../../../common/guards/roles.guard";
import { Roles } from "../../../../../../common/decorators/roles.decorator";

// Monitor de detecciones: exclusivo del Administrador (RF-07)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
@Controller("detecciones")
export class DeteccionesController {
    constructor(
        private readonly listarDeteccionesService: ListarDeteccionesService,
        private readonly listarMapaDeteccionesService: ListarMapaDeteccionesService,
        private readonly obtenerDeteccionService: ObtenerDeteccionService,
        private readonly obtenerKmlDeteccionService: ObtenerKmlDeteccionService,
        private readonly resumirDeteccionesService: ResumirDeteccionesService,
    ) {}

    @Get()
    async listar(@Query() consulta: ConsultarDeteccionesDto) {
        const { pagina, limite, ...filtros } = consulta;
        return await this.listarDeteccionesService.ejecutar({ filtros: this.aFiltros(filtros), pagina, limite });
    }

    // Puntos con coordenadas para el mapa de casos. Antes de ":id" para que no lo capture.
    @Get("mapa")
    async mapa(@Query() consulta: ConsultarMapaDeteccionesDto) {
        const { limite, ...filtros } = consulta;
        return await this.listarMapaDeteccionesService.ejecutar({ filtros: this.aFiltros(filtros), limite });
    }

    // Totales por categoría con los mismos filtros. Antes de ":id" para que no lo capture.
    @Get("resumen")
    async resumen(@Query() filtros: FiltrosDeteccionesDto) {
        return await this.resumirDeteccionesService.ejecutar(this.aFiltros(filtros));
    }

    // Punto de la captura para Google Earth, igual que el de las solicitudes
    @Get(":id/ubicacion.kml")
    async ubicacionKml(@Param("id", ParseUUIDPipe) id: string) {
        const { nombreArchivo, kml } = await this.obtenerKmlDeteccionService.ejecutar(id);

        return new StreamableFile(Buffer.from(kml, "utf-8"), {
            type: "application/vnd.google-earth.kml+xml",
            disposition: `attachment; filename="${nombreArchivo}"`,
        });
    }

    @Get(":id")
    async obtener(@Param("id", ParseUUIDPipe) id: string) {
        return await this.obtenerDeteccionService.ejecutar(id);
    }

    private aFiltros(dto: FiltrosDeteccionesDto): FiltrosDetecciones {
        return {
            ...dto,
            desde: dto.desde ? new Date(dto.desde) : undefined,
            hasta: dto.hasta ? this.finDeDia(dto.hasta) : undefined,
        };
    }

    // "hasta=2026-09-30" incluye todo ese día, no solo su primer instante
    private finDeDia(fecha: string): Date {
        const valor = new Date(fecha);
        if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) valor.setUTCHours(23, 59, 59, 999);
        return valor;
    }
}
