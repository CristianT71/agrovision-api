import type { RolUsuario } from "../../entities/usuario.entity";

export interface ValidarOtpCommand {
    telefono: string;
    codigo: string;
    // El panel lo omite; la app móvil lo usa para confirmar el flujo de productor.
    rolSeleccionado?: RolUsuario;
}

export interface RespuestaAutenticacion {
    accessToken: string;
    usuario: {
        id: string;
        telefono: string;
        rol: RolUsuario;
    };
}

export interface IValidarOtpUseCase {
    ejecutar(comando: ValidarOtpCommand): Promise<RespuestaAutenticacion>;
}
