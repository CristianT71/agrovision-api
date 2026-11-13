import { Injectable } from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rm, stat } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { Transform, type Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { TextDecoder } from "node:util";
import sharp from "sharp";
import { directorioArchivos } from "../../../../../../common/almacenamiento/local-almacenamiento.adapter";
import type { IAlmacenamientoVuelos } from "../../../../domain/ports/out/almacenamiento-vuelos.port";
import { FormatoVueloError } from "../../../../domain/errors/vuelos.error";

const MIMES: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".tif": "image/tiff",
    ".tiff": "image/tiff",
    ".dng": "image/x-adobe-dng",
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".srt": "application/x-subrip",
};

export function validarFirma(extension: string, cabecera: Buffer): void {
    let coincide = false;
    if ([".jpg", ".jpeg"].includes(extension)) coincide = cabecera[0] === 0xff && cabecera[1] === 0xd8;
    if ([".tif", ".tiff", ".dng"].includes(extension))
        coincide =
            cabecera.subarray(0, 4).equals(Buffer.from([0x49, 0x49, 0x2a, 0])) ||
            cabecera.subarray(0, 4).equals(Buffer.from([0x4d, 0x4d, 0, 0x2a]));
    if ([".mp4", ".mov"].includes(extension)) coincide = cabecera.subarray(4, 8).toString("ascii") === "ftyp";
    if (extension === ".srt") coincide = cabecera.length > 0;
    if (!coincide) throw new FormatoVueloError(422, "La firma del archivo no coincide con su extensión.");
}

@Injectable()
export class LocalVuelosAdapter implements IAlmacenamientoVuelos {
    private readonly raiz = resolve(directorioArchivos(), "vuelos");

    rutaLocal(ruta: string): string {
        const destino = resolve(this.raiz, ruta);
        if (!destino.startsWith(this.raiz + sep)) throw new Error("Ruta de vuelo no permitida.");
        return destino;
    }

    async recibir(vueloId: string, nombreOriginal: string, flujo: Readable, maxBytes: number) {
        const extension = extname(nombreOriginal).toLowerCase();
        if (!MIMES[extension]) throw new FormatoVueloError(415, "La extensión no está permitida.");
        if (!/^[0-9a-f-]{36}$/i.test(vueloId)) throw new Error("Identificador de vuelo inválido.");
        const id = randomUUID();
        const rutaAlmacenamiento = `${vueloId}/${id}${extension}`;
        const destino = this.rutaLocal(rutaAlmacenamiento);
        await mkdir(dirname(destino), { recursive: true });
        const hash = createHash("sha256");
        const cabecera = Buffer.alloc(16);
        let bytesCabecera = 0,
            tamanoBytes = 0;
        const decoder = new TextDecoder("utf-8", { fatal: true });
        const validarTexto = (texto: string) => {
            if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(texto))
                throw new FormatoVueloError(422, "El SRT debe contener texto UTF-8.");
        };
        const verificador = new Transform({
            transform(chunk: Buffer, _encoding, callback) {
                try {
                    tamanoBytes += chunk.length;
                    if (tamanoBytes > maxBytes)
                        throw new FormatoVueloError(413, "El archivo supera el tamaño permitido.");
                    const cantidad = Math.min(16 - bytesCabecera, chunk.length);
                    chunk.copy(cabecera, bytesCabecera, 0, cantidad);
                    bytesCabecera += cantidad;
                    if (extension === ".srt") {
                        try {
                            validarTexto(decoder.decode(chunk, { stream: true }));
                        } catch {
                            throw new FormatoVueloError(422, "El SRT debe contener texto UTF-8.");
                        }
                    }
                    hash.update(chunk);
                    callback(null, chunk);
                } catch (error) {
                    callback(error as Error);
                }
            },
            flush(callback) {
                try {
                    validarFirma(extension, cabecera.subarray(0, bytesCabecera));
                    if (extension === ".srt") {
                        try {
                            validarTexto(decoder.decode());
                        } catch {
                            throw new FormatoVueloError(422, "El SRT debe contener texto UTF-8.");
                        }
                    }
                    callback();
                } catch (error) {
                    callback(error as Error);
                }
            },
        });
        try {
            await pipeline(flujo, verificador, createWriteStream(destino, { flags: "wx" }));
            return {
                id,
                nombreOriginal: nombreOriginal.slice(0, 500),
                extension,
                mime: MIMES[extension],
                tamanoBytes,
                sha256: hash.digest("hex"),
                rutaAlmacenamiento,
            };
        } catch (error) {
            await rm(destino, { force: true });
            throw error;
        }
    }

    async miniatura(ruta: string, mime: string): Promise<boolean> {
        if (!["image/jpeg", "image/tiff"].includes(mime)) return false;
        try {
            let imagen = sharp(this.rutaLocal(ruta), { sequentialRead: true }).rotate();
            if (mime === "image/tiff") imagen = imagen.normalise();
            await imagen
                .resize(320, 320, { fit: "inside", withoutEnlargement: true })
                .jpeg({ quality: 80 })
                .toFile(this.rutaLocal(`${ruta}.miniatura.jpg`));
            return true;
        } catch {
            await rm(this.rutaLocal(`${ruta}.miniatura.jpg`), { force: true }).catch(() => undefined);
            return false;
        }
    }
    abrir(ruta: string, rango?: { inicio: number; fin: number }) {
        return createReadStream(this.rutaLocal(ruta), rango ? { start: rango.inicio, end: rango.fin } : undefined);
    }
    async tamano(ruta: string) {
        return (await stat(this.rutaLocal(ruta))).size;
    }
    async eliminarArchivo(ruta: string) {
        await Promise.all([
            rm(this.rutaLocal(ruta), { force: true }),
            rm(this.rutaLocal(`${ruta}.miniatura.jpg`), { force: true }),
        ]);
    }
    async eliminarVuelo(id: string) {
        await rm(this.rutaLocal(id), { recursive: true, force: true });
    }
}
