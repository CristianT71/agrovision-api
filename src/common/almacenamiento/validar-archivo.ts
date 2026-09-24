import { BadRequestException } from "@nestjs/common";
import type { ArchivoParaGuardar } from "./almacenamiento.port";

// Forma del archivo que entrega multer (memoryStorage) en los interceptores de subida
export interface ArchivoSubido {
    originalname: string;
    mimetype: string;
    size: number;
    buffer: Buffer;
}

export const TIPOS_IMAGEN = ["image/png", "image/jpeg", "image/webp"];
export const TIPOS_DOCUMENTO = ["application/pdf", ...TIPOS_IMAGEN];

// Firma de los primeros bytes de cada formato: el mimetype del cliente se puede falsificar
function detectarTipo(contenido: Buffer): string | null {
    if (contenido.subarray(0, 4).toString("latin1") === "%PDF") return "application/pdf";
    if (contenido.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
        return "image/png";
    if (contenido[0] === 0xff && contenido[1] === 0xd8 && contenido[2] === 0xff) return "image/jpeg";
    if (
        contenido.subarray(0, 4).toString("latin1") === "RIFF" &&
        contenido.subarray(8, 12).toString("latin1") === "WEBP"
    )
        return "image/webp";

    return null;
}

export function validarArchivo(
    archivo: ArchivoSubido,
    reglas: { tiposPermitidos: string[]; maxBytes: number },
): ArchivoParaGuardar {
    if (archivo.size > reglas.maxBytes) {
        const maxMb = Math.floor(reglas.maxBytes / (1024 * 1024));
        throw new BadRequestException(`El archivo "${archivo.originalname}" supera el límite de ${maxMb} MB.`);
    }

    const tipo = detectarTipo(archivo.buffer);
    if (!tipo || !reglas.tiposPermitidos.includes(tipo)) {
        throw new BadRequestException(`El archivo "${archivo.originalname}" no tiene un formato permitido.`);
    }

    return { nombreOriginal: archivo.originalname, tipoMime: tipo, contenido: archivo.buffer };
}
