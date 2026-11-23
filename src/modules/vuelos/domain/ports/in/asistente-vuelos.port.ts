import type { InformePdf } from "../out/asistente-ia.port";

export const ASISTENTE_VUELOS = "ASISTENTE_VUELOS";

export interface IAsistenteVuelos {
    conversar(vueloId: string, sessionId: string, chatInput: string): Promise<unknown>;
    descargarInforme(vueloId: string, codigo: string): Promise<InformePdf>;
}
