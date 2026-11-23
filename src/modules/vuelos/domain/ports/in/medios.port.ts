import type { Readable } from "node:stream";
export const LEER_MEDIO_VUELO = "LEER_MEDIO_VUELO";
export interface MedioVuelo {
    flujo: Readable;
    tamano: number;
    inicio: number;
    fin: number;
    parcial: boolean;
    mime: string;
    nombre: string;
    inline: boolean;
}
export interface ILeerMedioVuelo {
    ejecutar(token: string, range?: string): Promise<MedioVuelo>;
}
