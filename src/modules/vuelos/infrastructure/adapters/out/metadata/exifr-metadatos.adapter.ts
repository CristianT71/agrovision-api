import { Injectable } from "@nestjs/common";
import { createReadStream } from "node:fs";
import { extname } from "node:path";
import { StringDecoder } from "node:string_decoder";
import type { IExtractorMetadatos } from "../../../../domain/ports/out/extractor-metadatos.port";
import { normalizarTags } from "../../../../domain/services/normalizar-tags";
import { parsearSrt } from "../../../../domain/services/parser-srt";

// Interfaz mínima del lector externo; los datos no confiables se normalizan en el dominio.
const exifr = require("exifr") as {
    parse(ruta: string, opciones: Record<string, unknown>): Promise<Record<string, unknown> | undefined>;
};

// Lectura acotada incluso cuando un SRT malformado tiene una línea de varios gigabytes.
export async function* lineasAcotadas(ruta: string): AsyncGenerator<string> {
    const decoder = new StringDecoder("utf8");
    let pendiente = "",
        descartando = false;
    for await (const chunk of createReadStream(ruta, { highWaterMark: 64 * 1024 })) {
        const partes = decoder.write(chunk as Buffer).split("\n");
        for (let i = 0; i < partes.length; i++) {
            const segmento = partes[i];
            if (!descartando) {
                pendiente += segmento.slice(0, 16384 - pendiente.length);
                if (pendiente.length >= 16384) descartando = true;
            }
            if (i < partes.length - 1) {
                yield pendiente.replace(/\r$/, "");
                pendiente = "";
                descartando = false;
            }
        }
    }
    if (pendiente) yield pendiente + decoder.end();
}

@Injectable()
export class ExifrMetadatosAdapter implements IExtractorMetadatos {
    async extraer(ruta: string, nombre: string) {
        const extension = extname(nombre).toLowerCase();
        if (extension === ".srt") {
            const datos = normalizarTags({}, nombre);
            datos.metadatos.traza = await parsearSrt(lineasAcotadas(ruta));
            datos.metadatos.crudos.formatoSrtNoVerificado = true;
            return datos;
        }
        if ([".mp4", ".mov"].includes(extension)) return normalizarTags({}, nombre);
        try {
            // FsReader lee segmentos por posición: nunca se entrega el archivo como Buffer completo.
            // reviveValues=false conserva DateTimeOriginal tal como llegó, antes de aplicar la zona.
            const tags = await exifr.parse(ruta, {
                xmp: true,
                tiff: true,
                exif: true,
                gps: true,
                ifd1: false,
                makerNote: false,
                userComment: false,
                icc: false,
                iptc: false,
                skip: ["MakerNote", "Thumbnail", "StripOffsets", "StripByteCounts", "TileOffsets", "TileByteCounts"],
                reviveValues: false,
                translateValues: true,
                mergeOutput: true,
                chunked: true,
                chunkSize: 64 * 1024,
                chunkLimit: 128,
            });
            return normalizarTags(tags ?? {}, nombre);
        } catch {
            const datos = normalizarTags({}, nombre);
            datos.metadatos.crudos.extraccionFallida = true;
            return datos;
        }
    }
}
