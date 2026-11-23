import { Controller, Post, Get, Body, HttpCode, HttpStatus, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { SesionesService } from "../../../../application/use-cases/sesiones.service";
import { JwtAuthGuard } from "../../../../../../common/guards/jwt-auth.guard";
import { UsuarioActual } from "../../../../../../common/decorators/usuario-actual.decorator";
import { SolicitarOtpService } from "../../../../application/use-cases/solicitar-otp.service";
import { ValidarOtpService } from "../../../../application/use-cases/validar-otp.service";
import { SolicitarOtpDto } from "./dto/solicitar-otp.dto";
import { ValidarOtpDto } from "./dto/validar-otp.dto";
import { PoliticaDatosService } from "../../../../application/use-cases/politica-datos.service";
import { AceptarPoliticaDatosDto } from "./dto/politica-datos.dto";

// Rutas públicas: el límite por IP frena el envío masivo de SMS y el ataque de adivinar códigos
@Controller("auth")
export class AuthController {
    constructor(
        private readonly solicitarOtpService: SolicitarOtpService,
        private readonly validarOtpService: ValidarOtpService,
        private readonly sesionesService: SesionesService,
        private readonly politicaDatosService: PoliticaDatosService,
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

    // RF-01.8: invalida el token en el servidor; después de esto ya no sirve aunque alguien lo copie
    @Post("cerrar-sesion")
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.NO_CONTENT)
    async cerrarSesion(@UsuarioActual("sesionId") sesionId: string) {
        await this.sesionesService.cerrar(sesionId);
    }

    // Habeas data (Ley 1581 de 2012): qué versión de la política aceptó la persona y si sigue vigente
    @Get("politica-datos")
    @UseGuards(JwtAuthGuard)
    async consultarPoliticaDatos(@UsuarioActual("id") usuarioId: string) {
        return await this.politicaDatosService.consultar(usuarioId);
    }

    @Post("politica-datos/aceptar")
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.OK)
    async aceptarPoliticaDatos(@UsuarioActual("id") usuarioId: string, @Body() dto: AceptarPoliticaDatosDto) {
        return await this.politicaDatosService.aceptar(usuarioId, dto.version);
    }

    @Post("politica-datos/revocar")
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.OK)
    async revocarPoliticaDatos(@UsuarioActual("id") usuarioId: string) {
        return await this.politicaDatosService.revocar(usuarioId);
    }
}
