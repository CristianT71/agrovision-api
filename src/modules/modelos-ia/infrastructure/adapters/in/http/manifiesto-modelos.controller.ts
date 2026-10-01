import { Controller, Get, HttpStatus, Param, Query, Res, StreamableFile, UseGuards } from "@nestjs/common";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import type { Response } from "express";
import { ObtenerManifiestoService } from "../../../../application/use-cases/obtener-manifiesto.service";
import { DescargarArtefactoService } from "../../../../application/use-cases/descargar-artefacto.service";
import { ArtefactoParamsDto, ConsultarManifiestoDto } from "./dto/manifiesto.dto";

// Superficie pública de la app móvil: SIN JWT a propósito. La app no muestra inicio de sesión al
// abrir por primera vez, y si este endpoint exigiera token un usuario anónimo quedaría congelado
// en el modelo de fábrica para siempre (PublicApiService en la app). Lo protegen el límite por IP
// y la firma Ed25519 de los artefactos.
@UseGuards(ThrottlerGuard)
@Controller("public/v1/models")
export class ManifiestoModelosController {
    constructor(
        private readonly obtenerManifiestoService: ObtenerManifiestoService,
        private readonly descargarArtefactoService: DescargarArtefactoService,
    ) {}

    // La app consulta como mucho una vez al día; el margen cubre varios teléfonos tras la misma IP
    @Get("current")
    @Throttle({ publico: { limit: 60, ttl: 60_000 } })
    async actual(@Query() consulta: ConsultarManifiestoDto, @Res({ passthrough: true }) res: Response) {
        const manifiesto = await this.obtenerManifiestoService.ejecutar(consulta);

        // Sin modelo publicado: 204 y la app sigue con el que trae de fábrica
        if (!manifiesto) {
            res.status(HttpStatus.NO_CONTENT);
            return;
        }

        return manifiesto;
    }

    // Cada instalación descarga tres archivos (modelo, etiquetas y calibración)
    @Get(":version/:artefacto")
    @Throttle({ publico: { limit: 30, ttl: 60_000 } })
    async artefacto(@Param() params: ArtefactoParamsDto) {
        const { contenido, tipoMime, nombre } = await this.descargarArtefactoService.ejecutar(params);

        return new StreamableFile(contenido, {
            type: tipoMime,
            length: contenido.length,
            disposition: `attachment; filename="${nombre}"`,
        });
    }
}
