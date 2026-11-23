export const FIRMADOR_MEDIOS_VUELOS = "FIRMADOR_MEDIOS_VUELOS";
export type VarianteMedio = "contenido" | "miniatura";
export interface CargaMedio {
    archivoId: string;
    variante: VarianteMedio;
    exp: number;
}
export interface IFirmadorMedios {
    firmar(archivoId: string, variante: VarianteMedio, exp: number): string;
    verificar(token: string): CargaMedio;
}
