// Cuánto puede estar inactiva una sesión del panel (administrador y agrónomo) antes de cerrarse.
// Lo configura el administrador en Ajustes > Seguridad y acceso (RNF-02.2).
export interface IPoliticaSesion {
    minutosInactividadPanel(): Promise<number>;
}

export const POLITICA_SESION = "POLITICA_SESION";
