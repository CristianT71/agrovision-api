import { RolUsuario } from "../../entities/usuario.entity";

export interface ValidarOtpCommand {
    telefono: string;
    codigo: string;
    rolSeleccionado: RolUsuario;
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
