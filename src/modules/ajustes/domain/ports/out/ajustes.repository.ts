import type { AjustesPersonales, AjustesSistema } from "../../ajustes";

// Solo lo que la persona o el administrador han cambiado: lo demás lo completan los valores por defecto
export interface IAjustesRepository {
    obtenerPersonales(usuarioId: string): Promise<Partial<AjustesPersonales>>;
    guardarPersonales(usuarioId: string, ajustes: Partial<AjustesPersonales>): Promise<void>;
    obtenerSistema(): Promise<Partial<AjustesSistema>>;
    guardarSistema(ajustes: Partial<AjustesSistema>, usuarioId: string): Promise<void>;
}

export const AJUSTES_REPOSITORY = "AJUSTES_REPOSITORY";
