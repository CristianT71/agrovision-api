import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards } from "@nestjs/common";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import { SolicitarOtpService } from "../../../../application/use-cases/solicitar-otp.service";
import { ValidarOtpService } from "../../../../application/use-cases/validar-otp.service";
import { SolicitarOtpDto } from "./dto/solicitar-otp.dto";
import { ValidarOtpDto } from "./dto/validar-otp.dto";

// Rutas públicas: el límite por IP frena el envío masivo de SMS y el ataque de adivinar códigos
@UseGuards(ThrottlerGuard)
@Controller("auth")
export class AuthController {
    constructor(
        private readonly solicitarOtpService: SolicitarOtpService,
        private readonly validarOtpService: ValidarOtpService,
    ) {}

    // Cada solicitud puede enviar un SMS (con costo): máximo 5 por minuto desde la misma IP
    @Post("solicitar-otp")
    @Throttle({ publico: { limit: 5, ttl: 60_000 } })
    @HttpCode(HttpStatus.OK)
    async solicitarOtp(@Body() dto: SolicitarOtpDto) {
        return await this.solicitarOtpService.ejecutar(dto);
    }

    @Post("validar-otp")
    @Throttle({ publico: { limit: 10, ttl: 60_000 } })
    @HttpCode(HttpStatus.OK)
    async validarOtp(@Body() dto: ValidarOtpDto) {
        return await this.validarOtpService.ejecutar(dto);
    }
}
