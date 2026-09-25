import type { RolUsuario } from "../../entities/usuario.entity";

export interface SolicitarOtpCommand {
    telefono: string;
    // Opcional: el panel lo envía (agrónomo/admin); la app móvil de productores puede omitirlo
    rolSeleccionado?: RolUsuario;
}

export interface ISolicitarOtpUseCase {
    ejecutar(comando: SolicitarOtpCommand): Promise<{ mensaje: string; esperaSegundos: number }>;
}
