import type { RolUsuario } from "../../entities/usuario.entity";

export interface SolicitarOtpCommand {
    telefono: string;
    // Solo la app móvil envía productor para permitir el registro inicial.
    rolSeleccionado?: RolUsuario;
}

export interface ISolicitarOtpUseCase {
    ejecutar(comando: SolicitarOtpCommand): Promise<{ mensaje: string; esperaSegundos: number }>;
}
