import { BadRequestException, PayloadTooLargeException } from "@nestjs/common";
import { raw, type NextFunction, type Request, type Response } from "express";
import { MAX_BYTES_FOTO_SOLICITUD } from "../../../../application/use-cases/subir-foto-solicitud.service";

const leerBinario = raw({ type: "image/*", limit: MAX_BYTES_FOTO_SOLICITUD });

// express.raw deja el cuerpo image/* como Buffer. Sus errores no son HttpException y el filtro
// global los respondería como 500: se traducen para que la app reciba 413 o 400.
export function leerFotoBinaria(req: Request, res: Response, next: NextFunction): void {
    leerBinario(req, res, (error?: unknown) => {
        if (!error) return next();

        const status = (error as { status?: number }).status;
        next(
            status === 413
                ? new PayloadTooLargeException("La foto supera el límite de 10 MB.")
                : new BadRequestException("No se pudo leer la foto enviada."),
        );
    });
}
