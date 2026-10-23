export const CAPTURA_MODELO_REPOSITORY = "CAPTURA_MODELO_REPOSITORY";

export interface ICapturaModeloRepository {
    obtenerModeloIdPorIdCliente(idCliente: string | null): Promise<string | null>;
}
