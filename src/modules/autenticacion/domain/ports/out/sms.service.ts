export interface ISmsService {
    enviarOtp(telefono: string, codigo: string): Promise<boolean>;
}

export const SMS_SERVICE = "SMS_SERVICE";
