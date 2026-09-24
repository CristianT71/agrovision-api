export interface SolicitarOtpCommand {
    telefono: string;
}

export interface ISolicitarOtpUseCase {
    ejecutar(comando: SolicitarOtpCommand): Promise<{ mensaje: string; esperaSegundos: number }>;
}
