import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import type { ArchivoParaGuardar, IAlmacenamientoArchivos } from "./almacenamiento.port";

// Prefijo con el que main.ts sirve la carpeta pública
export const PREFIJO_URL_PUBLICA = "/archivos/";

const EXTENSIONES: Record<string, string> = {
    "application/pdf": ".pdf",
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
};

// Carpeta raíz de los archivos subidos (UPLOADS_DIR o ./uploads)
export function directorioArchivos(): string {
    return resolve(process.env.UPLOADS_DIR ?? "uploads");
}

@Injectable()
export class LocalAlmacenamientoAdapter implements IAlmacenamientoArchivos {
    private readonly raiz = directorioArchivos();

    async guardarPublico(carpeta: string, archivo: ArchivoParaGuardar): Promise<string> {
        const relativa = await this.escribir("publico", carpeta, archivo);

        return `${PREFIJO_URL_PUBLICA}${relativa}`;
    }

    async eliminarPublico(url: string): Promise<void> {
        // Las URLs externas (ej. fotos cargadas antes con un link) no son de este almacenamiento
        if (!url.startsWith(PREFIJO_URL_PUBLICA)) return;

        await rm(this.resolverDentroDe("publico", url.slice(PREFIJO_URL_PUBLICA.length)), { force: true });
    }

    async guardarPrivado(carpeta: string, archivo: ArchivoParaGuardar): Promise<string> {
        return await this.escribir("privado", carpeta, archivo);
    }

    async leerPrivado(ruta: string): Promise<Buffer> {
        return await readFile(this.resolverDentroDe("privado", ruta));
    }

    async eliminarPrivado(ruta: string): Promise<void> {
        await rm(this.resolverDentroDe("privado", ruta), { force: true });
    }

    // El nombre en disco es un UUID: el nombre original del cliente nunca forma parte de la ruta
    private async escribir(zona: string, carpeta: string, archivo: ArchivoParaGuardar): Promise<string> {
        const relativa = `${carpeta}/${randomUUID()}${EXTENSIONES[archivo.tipoMime] ?? ""}`;
        const destino = this.resolverDentroDe(zona, relativa);

        await mkdir(dirname(destino), { recursive: true });
        await writeFile(destino, archivo.contenido);

        return relativa;
    }

    // Evita que una ruta con ".." salga de la carpeta de archivos
    private resolverDentroDe(zona: string, relativa: string): string {
        const base = join(this.raiz, zona);
        const destino = resolve(base, relativa);

        if (!destino.startsWith(base + sep)) {
            throw new Error("Ruta de archivo no permitida.");
        }

        return destino;
    }
}
