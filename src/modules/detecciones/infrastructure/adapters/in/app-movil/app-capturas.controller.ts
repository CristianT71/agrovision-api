import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
import { RecibirCapturasService } from "../../../../application/use-cases/recibir-capturas.service";
import type { CapturaEntrada } from "../../../../domain/ports/in/recibir-capturas.port";
import { LoteCapturasAppDto, type CapturaAppDto } from "./dto/app-capturas.dto";
import { JwtAuthGuard } from "../../../../../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../../../../../common/guards/roles.guard";
import { Roles } from "../../../../../../common/decorators/roles.decorator";
import { UsuarioActual } from "../../../../../../common/decorators/usuario-actual.decorator";

// Ingesta de capturas de la app móvil (AgroVisionApiService.uploadCaptures). Versionada porque la
// app instalada no se actualiza al ritmo del servidor. La cabecera Idempotency-Key se acepta pero
// no hace falta: cada captura trae su propio id y reenviarla nunca la duplica.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("productor")
@Controller("v1/captures")
export class AppCapturasController {
    constructor(private readonly recibirCapturasService: RecibirCapturasService) {}

    @Post("batch")
    @HttpCode(HttpStatus.OK)
    async recibirLote(@Body() dto: LoteCapturasAppDto, @UsuarioActual("id") usuarioId: string) {
        return await this.recibirCapturasService.ejecutar({
            usuarioId,
            capturas: dto.captures.map((captura) => this.aEntrada(captura)),
        });
    }

    private aEntrada(dto: CapturaAppDto): CapturaEntrada {
        return {
            idCliente: dto.id,
            capturadaEn: dto.capturedAt,
            modeloVersion: dto.modelVersion,
            clasePredicha: dto.predictedClassId ?? null,
            confianza: dto.calibratedConfidence ?? null,
            puntajeOod: dto.oodScore,
            resultadoCompuerta: dto.gateOutcome,
            embedding: dto.embedding ?? null,
            correccionProductor: dto.userCorrectionClassId ?? null,
            confirmadaProductor: dto.userConfirmed,
            cultivo: dto.cropType ?? null,
            organo: dto.plantOrgan ?? null,
            ubicacion: dto.location
                ? {
                      latitud: dto.location.latitude,
                      longitud: dto.location.longitude,
                      precisionMetros: dto.location.accuracyMeters ?? null,
                  }
                : null,
        };
    }
}
