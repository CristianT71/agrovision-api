import { BadRequestException, ForbiddenException, PayloadTooLargeException } from "@nestjs/common";
import { raw, type NextFunction, type Request, type Response } from "express";
import { MAX_BYTES_FOTO_SOLICITUD } from "../../../../application/use-cases/subir-foto-solicitud.service";

const leerBinario = raw({ type: "image/*", limit: MAX_BYTES_FOTO_SOLICITUD });

// El token de subida es el último tramo de la ruta: /api/v1/uploads/:token
function tokenDeLaRuta(req: Request): string {
    const ruta = req.originalUrl.split("?")[0];
    try {
        return decodeURIComponent(ruta.slice(ruta.lastIndexOf("/") + 1));
    } catch {
        return "";
    }
}

// Esta ruta no lleva JWT: el token firmado de la URL es la única autorización. Se comprueba ANTES de
// leer el cuerpo: si no, cualquiera podría mandar fotos de 10 MB con tokens inventados y obligar al
// servidor a leerlas enteras en memoria antes de rechazarlas.
// La firma y el vencimiento se verifican barato (HMAC); la existencia de la foto la revisa el caso de uso.
//
// express.raw deja el cuerpo image/* como Buffer. Sus errores no son HttpException y el filtro
// global los respondería como 500: se traducen para que la app reciba 413 o 400.
export function crearLectorFotoBinaria(tokenValido: (token: string) => boolean) {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!tokenValido(tokenDeLaRuta(req))) {
            return next(new ForbiddenException("La URL de subida no es válida o ya venció."));
        }

        leerBinario(req, res, (error?: unknown) => {
            if (!error) return next();

            const status = (error as { status?: number }).status;
            next(
                status === 413
                    ? new PayloadTooLargeException("La foto supera el límite de 10 MB.")
                    : new BadRequestException("No se pudo leer la foto enviada."),
            );
        });
    };
}
