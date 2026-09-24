import { SesionOtp } from "../../entities/sesion-otp.entity";

export interface ISesionOtpRepository {
    findUltimaPorUsuarioId(usuarioId: string): Promise<SesionOtp | null>;
    guardar(sesionOtp: SesionOtp): Promise<void>;
    // Suma un intento fallido de forma atómica en la base de datos
    registrarIntentoFallido(id: string): Promise<void>;
    // Marca el código como usado solo si seguía libre. Devuelve false si otra petición
    // lo consumió primero, así un mismo código no sirve para dos sesiones.
    consumir(id: string): Promise<boolean>;
}

export const SESION_OTP_REPOSITORY = "SESION_OTP_REPOSITORY";
