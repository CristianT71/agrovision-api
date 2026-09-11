import { Inject, Injectable, UnauthorizedException, BadRequestException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { IValidarOtpUseCase, ValidarOtpCommand, RespuestaAutenticacion } from "../../domain/ports/in/validar-otp.port";
import { USUARIO_REPOSITORY, type IUsuarioRepository } from "../../domain/ports/out/usuario.repository";
import { SESION_OTP_REPOSITORY, type ISesionOtpRepository } from "../../domain/ports/out/sesion-otp.repository";

@Injectable()
export class ValidarOtpService implements IValidarOtpUseCase {
    constructor(
        @Inject(USUARIO_REPOSITORY)
        private readonly usuarioRepository: IUsuarioRepository,
        @Inject(SESION_OTP_REPOSITORY)
        private readonly sesionOtpRepository: ISesionOtpRepository,
        private readonly jwtService: JwtService,
    ) {}

    async ejecutar(comando: ValidarOtpCommand): Promise<RespuestaAutenticacion> {
        const { telefono, codigo, rolSeleccionado } = comando;

        const usuario = await this.usuarioRepository.findByTelefono(telefono);
        if (!usuario) {
            throw new UnauthorizedException("Credenciales inválidas.");
        }

        const ultimaSesion = await this.sesionOtpRepository.findUltimaPorUsuarioId(usuario.id);
        if (!ultimaSesion || !ultimaSesion.esValido(codigo)) {
            throw new BadRequestException("El código OTP es inválido o ha expirado.");
        }

        // Marcar como usado
        ultimaSesion.marcarComoUsado();
        await this.sesionOtpRepository.guardar(ultimaSesion);

        // Actualizar rol seleccionado si aplica (RF-01.2)
        usuario.rol = rolSeleccionado;
        await this.usuarioRepository.guardar(usuario);

        // Generar Token JWT
        const payload = { sub: usuario.id, telefono: usuario.telefono, rol: usuario.rol };
        const accessToken = this.jwtService.sign(payload);

        return {
            accessToken,
            usuario: {
                id: usuario.id,
                telefono: usuario.telefono,
                rol: usuario.rol,
            },
        };
    }
}
