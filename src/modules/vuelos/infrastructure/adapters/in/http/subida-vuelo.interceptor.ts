import {
    Inject,
    Injectable,
    UnprocessableEntityException,
    type CallHandler,
    type ExecutionContext,
    type NestInterceptor,
} from "@nestjs/common";
import type { Request, Response } from "express";
import type { Readable } from "node:stream";
import type { ArchivoRecibido } from "../../../../domain/entities/vuelo";
import {
    ALMACENAMIENTO_VUELOS,
    type IAlmacenamientoVuelos,
} from "../../../../domain/ports/out/almacenamiento-vuelos.port";
import { FormatoVueloError } from "../../../../domain/errors/vuelos.error";

// Solo se usa la interfaz de StorageEngine; evita memoryStorage y cualquier Buffer del archivo completo.
interface ArchivoMultipart extends Partial<ArchivoRecibido> {
    originalname: string;
    stream: Readable;
}
type Callback = (error: Error | null, archivo?: Partial<ArchivoRecibido>) => void;
interface OpcionesMultipart {
    storage: {
        _handleFile(req: Request, file: ArchivoMultipart, cb: Callback): void;
        _removeFile(req: Request, file: ArchivoMultipart, cb: (error: Error | null) => void): void;
    };
    limits: { fileSize: number; files: number; fields: number; parts: number; fieldNameSize: number };
}
// Multer ya es dependencia de platform-express; se declara también de forma directa en package.json.
const multer = require("multer") as (opciones: OpcionesMultipart) => {
    single(campo: string): (req: Request, res: Response, cb: (error?: Error & { code?: string }) => void) => void;
};

export function maximoArchivoBytes(): number {
    const mb = Number(process.env.VUELOS_MAX_ARCHIVO_MB ?? 2048);
    if (!Number.isFinite(mb) || mb <= 0 || !Number.isSafeInteger(Math.floor(mb * 1024 * 1024)))
        throw new Error("VUELOS_MAX_ARCHIVO_MB debe ser un número positivo.");
    return Math.max(1, Math.floor(mb * 1024 * 1024));
}

@Injectable()
export class SubidaVueloInterceptor implements NestInterceptor {
    constructor(@Inject(ALMACENAMIENTO_VUELOS) private readonly disco: IAlmacenamientoVuelos) {
        maximoArchivoBytes();
    }
    async intercept(contexto: ExecutionContext, siguiente: CallHandler) {
        const req = contexto.switchToHttp().getRequest<Request>(),
            res = contexto.switchToHttp().getResponse<Response>();
        if (!req.is("multipart/form-data"))
            throw new UnprocessableEntityException("Se requiere multipart/form-data con un archivo.");
        const maxBytes = maximoArchivoBytes();
        const subir = multer({
            storage: {
                _handleFile: (request, file, cb) => {
                    const abortar = () => file.stream.destroy(new Error("La subida fue interrumpida."));
                    request.once("aborted", abortar);
                    void this.disco
                        .recibir(request.params.id as string, file.originalname, file.stream, maxBytes)
                        .then(
                            (a) => cb(null, a),
                            (e) => cb(e as Error),
                        )
                        .finally(() => request.removeListener("aborted", abortar));
                },
                _removeFile: (_request, file, cb) => {
                    void (
                        file.rutaAlmacenamiento
                            ? this.disco.eliminarArchivo(file.rutaAlmacenamiento)
                            : Promise.resolve()
                    ).then(
                        () => cb(null),
                        (e) => cb(e as Error),
                    );
                },
            },
            limits: { fileSize: maxBytes, files: 1, fields: 0, parts: 2, fieldNameSize: 100 },
        }).single("archivo");
        await new Promise<void>((resolve, reject) =>
            subir(req, res, (error) => {
                if (!error) return resolve();
                if (error.code === "LIMIT_FILE_SIZE")
                    return reject(new FormatoVueloError(413, "El archivo supera el tamaño permitido."));
                if (error instanceof FormatoVueloError) return reject(error);
                reject(
                    new UnprocessableEntityException(
                        "El formulario multipart no es válido; envía un solo archivo en el campo archivo.",
                    ),
                );
            }),
        );
        return siguiente.handle();
    }
}
