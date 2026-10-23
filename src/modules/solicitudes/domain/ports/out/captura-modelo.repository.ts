export const CAPTURA_MODELO_REPOSITORY = "CAPTURA_MODELO_REPOSITORY";

export interface ICapturaModeloRepository {
    obtenerModeloIdPorIdCliente(idCliente: string | null): Promise<string | null>;
    // La versión que la app declara en la propia solicitud: sirve cuando la captura nunca se subió
    // (el productor no dio su consentimiento) y el servidor no la tiene
    obtenerModeloIdPorVersion(version: string | null): Promise<string | null>;
}
