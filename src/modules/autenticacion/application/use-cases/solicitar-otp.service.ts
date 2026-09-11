import { Inject, Injectable, BadRequestException } from "@nestjs/common";
import { ISolicitarOtpUseCase, SolicitarOtpCommand } from "../../domain/ports/in/solicitar-otp.port";
import { USUARIO_REPOSITORY, type IUsuarioRepository } from "../../domain/ports/out/usuario.repository";
import { SESION_OTP_REPOSITORY, type ISesionOtpRepository } from "../../domain/ports/out/sesion-otp.repository";
import { SMS_SERVICE, type ISmsService } from "../../domain/ports/out/sms.service";
import { Usuario } from "../../domain/entities/usuario.entity";
import { SesionOtp } from "../../domain/entities/sesion-otp.entity";
import { v4 as uuidv4 } from "uuid";

@Injectable()
export class SolicitarOtpService implements ISolicitarOtpUseCase {
    constructor(
        @Inject(USUARIO_REPOSITORY)
        private readonly usuarioRepository: IUsuarioRepository,
        @Inject(SESION_OTP_REPOSITORY)
        private readonly sesionOtpRepository: ISesionOtpRepository,
        @Inject(SMS_SERVICE)
        private readonly smsService: ISmsService,
    ) {}

    async ejecutar(comando: SolicitarOtpCommand): Promise<{ mensaje: string }> {
        const { telefono } = comando;

        // 1. Buscar o registrar al usuario si es la primera vez
        let usuario = await this.usuarioRepository.findByTelefono(telefono);
        if (!usuario) {
            usuario = new Usuario(uuidv4(), telefono, "productor", "activo", new Date());
            await this.usuarioRepository.guardar(usuario);
        }

        // 2. Verificar la regla de los 30 segundos (RF-01.5)
        const ultimaSesion = await this.sesionOtpRepository.findUltimaPorUsuarioId(usuario.id);
        if (ultimaSesion && !ultimaSesion.puedeSolicitarNuevoOtp(30)) {
            throw new BadRequestException("Debe esperar al menos 30 segundos entre solicitudes de código OTP.");
        }

        // 3. Generar código numérico de 6 dígitos
        const codigoOtp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiraEn = new Date(Date.now() + 5 * 60 * 1000); // 5 minutos de validez

        const nuevaSesion = new SesionOtp(uuidv4(), usuario.id, codigoOtp, expiraEn, false, new Date());
        await this.sesionOtpRepository.guardar(nuevaSesion);

        // 4. Enviar mediante el puerto SMS (Twilio/Zavu/Logger)
        await this.smsService.enviarOtp(telefono, codigoOtp);

        return { mensaje: "Código OTP enviado exitosamente." };
    }
}
