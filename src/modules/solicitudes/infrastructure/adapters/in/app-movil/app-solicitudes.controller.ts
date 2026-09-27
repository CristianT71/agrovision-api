import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, UseGuards } from "@nestjs/common";
import { RecibirLoteSolicitudesService } from "../../../../application/use-cases/recibir-lote-solicitudes.service";
import { ListarMisSolicitudesService } from "../../../../application/use-cases/listar-mis-solicitudes.service";
import type { SolicitudAppEntrada } from "../../../../domain/ports/in/solicitudes-app.port";
import { LoteSolicitudesAppDto, MisSolicitudesAppQueryDto, type SolicitudAppDto } from "./dto/app-solicitudes.dto";
import { JwtAuthGuard } from "../../../../../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../../../../../common/guards/roles.guard";
import { Roles } from "../../../../../../common/decorators/roles.decorator";
import { UsuarioActual } from "../../../../../../common/decorators/usuario-actual.decorator";

// Rutas que consume la app móvil del productor. Versionadas porque la app instalada no se
// actualiza al mismo ritmo que el servidor. La cabecera Idempotency-Key se acepta pero no hace
// falta: cada solicitud trae su propio id y reenviarla nunca la duplica.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("productor")
@Controller("v1/review-requests")
export class AppSolicitudesController {
    constructor(
        private readonly recibirLoteService: RecibirLoteSolicitudesService,
        private readonly listarMisSolicitudesService: ListarMisSolicitudesService,
    ) {}

    @Post("batch")
    @HttpCode(HttpStatus.OK)
    async recibirLote(@Body() dto: LoteSolicitudesAppDto, @UsuarioActual("id") usuarioId: string) {
        return await this.recibirLoteService.ejecutar({
            usuarioId,
            solicitudes: dto.requests.map((solicitud) => this.aEntrada(solicitud)),
        });
    }

    @Get("mine")
    async mias(@Query() query: MisSolicitudesAppQueryDto, @UsuarioActual("id") usuarioId: string) {
        return await this.listarMisSolicitudesService.ejecutar({ usuarioId, desde: query.since });
    }

    private aEntrada(dto: SolicitudAppDto): SolicitudAppEntrada {
        return {
            idCliente: dto.id,
            capturaId: dto.captureId ?? null,
            cultivo: dto.cropType,
            organo: dto.plantOrgan,
            nota: dto.noteText ?? null,
            creadaEn: dto.createdAt,
            ubicacion: dto.location
                ? {
                      latitud: dto.location.latitude,
                      longitud: dto.location.longitude,
                      precisionMetros: dto.location.accuracyMeters ?? null,
                  }
                : null,
            fotos: dto.images.map((imagen) => ({ idCliente: imagen.id, angulo: imagen.angle })),
        };
    }
}
