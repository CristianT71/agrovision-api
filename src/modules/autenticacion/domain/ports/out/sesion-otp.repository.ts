import { SesionOtp } from "../../entities/sesion-otp.entity";

export interface ISesionOtpRepository {
    findUltimaPorUsuarioId(usuarioId: string): Promise<SesionOtp | null>;
    // Códigos que se le han generado a la cuenta desde ese momento (cada uno reinicia sus intentos)
    contarDesde(usuarioId: string, desde: Date): Promise<number>;
    guardar(sesionOtp: SesionOtp): Promise<void>;
    // Gasta un intento ANTES de comparar el código, con un UPDATE condicionado (bloquea la fila):
    // solo prospera si el código sigue libre, vigente y con intentos. Así peticiones simultáneas
    // no pueden comparar más códigos que los permitidos. Devuelve false si ya no quedaban.
    reservarIntento(id: string): Promise<boolean>;
    // Marca el código como usado solo si seguía libre y vigente. Devuelve false si otra petición
    // lo consumió primero o venció entretanto, así un mismo código no sirve para dos sesiones.
    consumir(id: string): Promise<boolean>;
}

export const SESION_OTP_REPOSITORY = "SESION_OTP_REPOSITORY";
