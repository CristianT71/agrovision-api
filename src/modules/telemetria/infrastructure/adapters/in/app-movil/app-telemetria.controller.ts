import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import { RegistrarEventoService } from "../../../../application/use-cases/registrar-evento.service";

// Superficie pública de la app: SIN JWT, igual que el manifiesto de modelos. La app mide aunque
// el productor no haya iniciado sesión. La protege el límite de peticiones por IP.
@UseGuards(ThrottlerGuard)
@Controller("public/v1/telemetry")
export class AppTelemetriaController {
    constructor(private readonly registrarEventoService: RegistrarEventoService) {}

    // El cuerpo es un mapa plano de textos (Map<String, String> en la app). Se recibe como
    // Record a propósito: el ValidationPipe global no lo valida y las claves desconocidas se
    // ignoran, así una versión nueva de la app que mande un dato extra no pierde sus eventos.
    // La validación real la hace el dominio.
    @Post("field-metrics")
    @HttpCode(HttpStatus.ACCEPTED)
    @Throttle({ publico: { limit: 120, ttl: 60_000 } })
    async registrar(@Body() mapa: Record<string, unknown>): Promise<void> {
        await this.registrarEventoService.ejecutar(mapa ?? {});
    }
}
