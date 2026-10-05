import type { SesionUsuario } from "../../entities/sesion-usuario.entity";

export interface ISesionUsuarioRepository {
    crear(sesion: SesionUsuario): Promise<void>;
    findById(id: string): Promise<SesionUsuario | null>;
    registrarActividad(id: string, fecha: Date): Promise<void>;
    revocar(id: string, fecha: Date): Promise<void>;
}

export const SESION_USUARIO_REPOSITORY = "SESION_USUARIO_REPOSITORY";
