import type { DatosExtraidos } from "../../entities/vuelo";
export const EXTRACTOR_METADATOS_VUELOS = "EXTRACTOR_METADATOS_VUELOS";
export interface IExtractorMetadatos {
    extraer(rutaLocal: string, nombreOriginal: string): Promise<DatosExtraidos>;
}
