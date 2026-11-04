export interface AceptacionPoliticaDatos {
    version: string | null;
    fecha: Date | null;
}

export interface IPoliticaDatosRepository {
    obtener(usuarioId: string): Promise<AceptacionPoliticaDatos | null>;
    registrar(usuarioId: string, version: string, fecha: Date): Promise<void>;
    revocar(usuarioId: string): Promise<void>;
}

export const POLITICA_DATOS_REPOSITORY = "POLITICA_DATOS_REPOSITORY";
