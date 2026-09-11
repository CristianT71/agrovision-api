import { SesionOtp } from "../../entities/sesion-otp.entity";

export interface ISesionOtpRepository {
    findUltimaPorUsuarioId(usuarioId: string): Promise<SesionOtp | null>;
    guardar(sesionOtp: SesionOtp): Promise<void>;
}

export const SESION_OTP_REPOSITORY = "SESION_OTP_REPOSITORY";
