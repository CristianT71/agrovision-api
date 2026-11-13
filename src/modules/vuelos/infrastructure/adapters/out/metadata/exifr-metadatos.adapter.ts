import { Injectable } from "@nestjs/common";
import { createReadStream } from "node:fs";
import { open } from "node:fs/promises";
import { extname } from "node:path";
import { StringDecoder } from "node:string_decoder";
import type { IExtractorMetadatos } from "../../../../domain/ports/out/extractor-metadatos.port";
import { normalizarTags } from "../../../../domain/services/normalizar-tags";
import { parsearSrt } from "../../../../domain/services/parser-srt";

// Interfaz mínima del lector externo; los datos no confiables se normalizan en el dominio.
const exifr = require("exifr") as {
    parse(entrada: string | Buffer, opciones: Record<string, unknown>): Promise<Record<string, unknown> | undefined>;
};

// exifr falla al leer por ruta en Node 26 (FileHandle.stat exige un objeto). Se entrega solo la
// cabecera del archivo como Buffer: allí vive el EXIF/XMP y la memoria queda acotada.
const BYTES_CABECERA = 4 * 1024 * 1024;
async function leerCabecera(ruta: string): Promise<Buffer> {
    const archivo = await open(ruta, "r");
    try {
        const { size } = await archivo.stat({});
        const buffer = Buffer.alloc(Math.min(size, BYTES_CABECERA));
        const { bytesRead } = await archivo.read(buffer, 0, buffer.length, 0);
        return buffer.subarray(0, bytesRead);
    } finally {
        await archivo.close();
    }
}

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
            const cabecera = await leerCabecera(ruta);
            // reviveValues=false conserva DateTimeOriginal tal como llegó, antes de aplicar la zona.
            const tags = await exifr.parse(cabecera, {
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
                chunked: false,
            });
            return normalizarTags(tags ?? {}, nombre);
        } catch {
            const datos = normalizarTags({}, nombre);
            datos.metadatos.crudos.extraccionFallida = true;
            return datos;
        }
    }
}
