import { Inject, Injectable, UnauthorizedException, ForbiddenException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { IValidarOtpUseCase, ValidarOtpCommand, RespuestaAutenticacion } from "../../domain/ports/in/validar-otp.port";
import { USUARIO_REPOSITORY, type IUsuarioRepository } from "../../domain/ports/out/usuario.repository";
import { SESION_OTP_REPOSITORY, type ISesionOtpRepository } from "../../domain/ports/out/sesion-otp.repository";
import { AGRONOMO_REPOSITORY, type IAgronomoRepository } from "../../../agronomos/domain/ports/out/agronomo.repository";
import type { Usuario } from "../../domain/entities/usuario.entity";

// Un solo mensaje para cualquier fallo de credenciales: no revela si el teléfono existe
const CREDENCIALES_INVALIDAS = "El código OTP es inválido o ha expirado.";

@Injectable()
export class ValidarOtpService implements IValidarOtpUseCase {
    constructor(
        @Inject(USUARIO_REPOSITORY)
        private readonly usuarioRepository: IUsuarioRepository,
        @Inject(SESION_OTP_REPOSITORY)
        private readonly sesionOtpRepository: ISesionOtpRepository,
        @Inject(AGRONOMO_REPOSITORY)
        private readonly agronomoRepository: IAgronomoRepository,
        private readonly jwtService: JwtService,
    ) {}

    async ejecutar(comando: ValidarOtpCommand): Promise<RespuestaAutenticacion> {
        const { telefono, codigo, rolSeleccionado } = comando;

        const usuario = await this.usuarioRepository.findByTelefono(telefono);
        if (!usuario) {
            throw new UnauthorizedException(CREDENCIALES_INVALIDAS);
        }

        const ultimaSesion = await this.sesionOtpRepository.findUltimaPorUsuarioId(usuario.id);
        if (!ultimaSesion || !ultimaSesion.estaDisponible()) {
            throw new UnauthorizedException(CREDENCIALES_INVALIDAS);
        }

        if (!ultimaSesion.coincide(codigo)) {
            await this.sesionOtpRepository.registrarIntentoFallido(ultimaSesion.id);
            throw new UnauthorizedException(CREDENCIALES_INVALIDAS);
        }

        // RF-01.2: el rol seleccionado se valida contra el de la cuenta, nunca se asigna.
        // Se revisa antes de consumir el código para que el usuario pueda corregir el rol.
        if (!usuario.tieneRol(rolSeleccionado)) {
            throw new ForbiddenException("El rol seleccionado no corresponde a esta cuenta.");
        }

        await this.verificarCuentaHabilitada(usuario);

        // Marcar como usado de forma atómica: si otra petición lo consumió primero, se rechaza
        const consumido = await this.sesionOtpRepository.consumir(ultimaSesion.id);
        if (!consumido) {
            throw new UnauthorizedException(CREDENCIALES_INVALIDAS);
        }

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

    private async verificarCuentaHabilitada(usuario: Usuario): Promise<void> {
        if (!usuario.estaActivo()) {
            throw new ForbiddenException("La cuenta no está activa.");
        }

        if (usuario.rol !== "agronomo") return;

        // RF-10.5: un agrónomo nuevo queda pendiente hasta que un administrador lo valide
        const agronomo = await this.agronomoRepository.findByUsuarioId(usuario.id);
        if (!agronomo || agronomo.estado === "pendiente") {
            throw new ForbiddenException("Tu cuenta de agrónomo está pendiente de validación por un administrador.");
        }

        if (agronomo.estado !== "activo") {
            throw new ForbiddenException("Tu cuenta de agrónomo se encuentra inactiva.");
        }
    }
}
