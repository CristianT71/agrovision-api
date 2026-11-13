import type { Json } from "../entities/vuelo";
import { numero } from "./normalizar-tags";

// Contrato provisional DJI: tolera mayúsculas, espacios y varios tags dentro del mismo par de corchetes.
export function puntoSrt(linea: string, tiempo: string | null): Json | null {
    const valor = (tag: string) =>
        numero(new RegExp(`\\b${tag}\\s*:\\s*([+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+))`, "i").exec(linea)?.[1]);
    const lat = valor("latitude"),
        lon = valor("longitude");
    if (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
    return { tiempo, lat, lon, rel_alt: valor("rel_alt"), abs_alt: valor("abs_alt") };
}

export async function parsearSrt(lineas: AsyncIterable<string>): Promise<Json[]> {
    const puntos: Json[] = [];
    let tiempo: string | null = null;
    for await (const linea of lineas) {
        const marca = /(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*-->/.exec(linea)?.[1];
        if (marca) tiempo = marca.replace(",", ".");
        const punto = puntoSrt(linea, tiempo);
        if (punto) puntos.push(punto);
        if (puntos.length >= 500) break;
    }
    return puntos;
}
