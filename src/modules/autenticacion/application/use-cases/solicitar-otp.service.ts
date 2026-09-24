import { Inject, Injectable, ForbiddenException, HttpException, HttpStatus } from "@nestjs/common";
import { randomInt } from "node:crypto";
import { ISolicitarOtpUseCase, SolicitarOtpCommand } from "../../domain/ports/in/solicitar-otp.port";
import { USUARIO_REPOSITORY, type IUsuarioRepository } from "../../domain/ports/out/usuario.repository";
import { SESION_OTP_REPOSITORY, type ISesionOtpRepository } from "../../domain/ports/out/sesion-otp.repository";
import { SMS_SERVICE, type ISmsService } from "../../domain/ports/out/sms.service";
import { Usuario } from "../../domain/entities/usuario.entity";
import { SesionOtp } from "../../domain/entities/sesion-otp.entity";
import { v4 as uuidv4 } from "uuid";

const SEGUNDOS_ENTRE_SOLICITUDES = 30;
const MINUTOS_VIGENCIA_OTP = 5;

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

    async ejecutar(comando: SolicitarOtpCommand): Promise<{ mensaje: string; esperaSegundos: number }> {
        const { telefono } = comando;

        // 1. Buscar al usuario. Si es la primera vez se registra como productor (app móvil)
        let usuario = await this.usuarioRepository.findByTelefono(telefono);
        if (!usuario) {
            usuario = Usuario.registrarProductor(uuidv4(), telefono);
            await this.usuarioRepository.guardar(usuario);
        } else if (!usuario.estaActivo()) {
            throw new ForbiddenException("La cuenta asociada a este número no está activa.");
        }

        // 2. Verificar la regla de los 30 segundos (RF-01.5)
        const ultimaSesion = await this.sesionOtpRepository.findUltimaPorUsuarioId(usuario.id);
        if (ultimaSesion && !ultimaSesion.puedeSolicitarNuevoOtp(SEGUNDOS_ENTRE_SOLICITUDES)) {
            const restantes = ultimaSesion.segundosRestantesParaNuevoOtp(SEGUNDOS_ENTRE_SOLICITUDES);
            throw new HttpException(
                `Debe esperar ${restantes} segundos para solicitar un nuevo código OTP.`,
                HttpStatus.TOO_MANY_REQUESTS,
            );
        }

        // 3. Generar código numérico de 6 dígitos con un generador criptográfico
        const codigoOtp = randomInt(0, 1_000_000).toString().padStart(6, "0");

        const nuevaSesion = SesionOtp.crear({
            id: uuidv4(),
            usuarioId: usuario.id,
            codigo: codigoOtp,
            minutosVigencia: MINUTOS_VIGENCIA_OTP,
        });
        await this.sesionOtpRepository.guardar(nuevaSesion);

        // 4. Enviar mediante el puerto SMS (Twilio/Zavu/Logger)
        await this.smsService.enviarOtp(telefono, codigoOtp);

        return { mensaje: "Código OTP enviado exitosamente.", esperaSegundos: SEGUNDOS_ENTRE_SOLICITUDES };
    }
}
