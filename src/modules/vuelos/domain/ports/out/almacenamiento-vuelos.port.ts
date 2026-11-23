import type { Readable } from "node:stream";
import type { ArchivoRecibido } from "../../entities/vuelo";
export const ALMACENAMIENTO_VUELOS = "ALMACENAMIENTO_VUELOS";
export interface IAlmacenamientoVuelos {
    recibir(vueloId: string, nombreOriginal: string, flujo: Readable, maxBytes: number): Promise<ArchivoRecibido>;
    rutaLocal(ruta: string): string;
    miniatura(ruta: string, mime: string): Promise<boolean>;
    abrir(ruta: string, rango?: { inicio: number; fin: number }): Readable;
    tamano(ruta: string): Promise<number>;
    eliminarArchivo(ruta: string): Promise<void>;
    eliminarVuelo(id: string): Promise<void>;
}
