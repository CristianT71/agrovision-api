import { Controller, Post, Body, HttpCode, HttpStatus } from "@nestjs/common";
import { SolicitarOtpService } from "../../../../application/use-cases/solicitar-otp.service";
import { ValidarOtpService } from "../../../../application/use-cases/validar-otp.service";
import { SolicitarOtpDto } from "./dto/solicitar-otp.dto";
import { ValidarOtpDto } from "./dto/validar-otp.dto";

@Controller("auth")
export class AuthController {
    constructor(
        private readonly solicitarOtpService: SolicitarOtpService,
        private readonly validarOtpService: ValidarOtpService,
    ) {}

    @Post("solicitar-otp")
    @HttpCode(HttpStatus.OK)
    async solicitarOtp(@Body() dto: SolicitarOtpDto) {
        return await this.solicitarOtpService.ejecutar(dto);
    }

    @Post("validar-otp")
    @HttpCode(HttpStatus.OK)
    async validarOtp(@Body() dto: ValidarOtpDto) {
        return await this.validarOtpService.ejecutar(dto);
    }
}
