export interface PreferenciaCorreo {
    activo: boolean;
    correo: string | null;
}

// Si la persona quiere recibir sus notificaciones también por correo, y a cuál
export interface IPreferenciasCorreo {
    obtener(usuarioId: string): Promise<PreferenciaCorreo>;
    guardar(usuarioId: string, preferencia: PreferenciaCorreo): Promise<void>;
}

export const PREFERENCIAS_CORREO = "PREFERENCIAS_CORREO";
