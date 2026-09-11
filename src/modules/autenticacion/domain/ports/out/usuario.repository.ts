import { Usuario } from "../../entities/usuario.entity";

export interface IUsuarioRepository {
    findByTelefono(telefono: string): Promise<Usuario | null>;
    findById(id: string): Promise<Usuario | null>;
    guardar(usuario: Usuario): Promise<Usuario>;
}

export const USUARIO_REPOSITORY = "USUARIO_REPOSITORY";
