import type { ServeStaticOptions } from "@nestjs/platform-express/interfaces/serve-static-options.interface";
import type { NextFunction, Request, Response } from "express";

// Solo archivos generados por guardarPublico("plagas", ...), nunca rutas suministradas por el cliente.
export const RUTA_FOTO_CATALOGO =
    /^\/archivos\/plagas\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/i;

// Se monta en /archivos/plagas: req.path es la parte restante, sin el prefijo ni la query.
export function soloFotosCatalogo(req: Request, res: Response, next: NextFunction): void {
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (!["GET", "HEAD"].includes(req.method) || !RUTA_FOTO_CATALOGO.test(`/archivos/plagas${req.path}`)) {
        res.status(404).end();
        return;
    }
    next();
}

export const OPCIONES_FOTOS_CATALOGO: ServeStaticOptions = {
    prefix: "/archivos/plagas/",
    index: false,
    redirect: false,
    dotfiles: "deny",
    setHeaders(res: Response, ruta: string) {
        res.setHeader("X-Content-Type-Options", "nosniff");
        // El tipo se determina por la extensión controlada por el almacenamiento, no por el cliente.
        const extension = ruta.split(".").pop()?.toLowerCase();
        const tipo = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" }[extension ?? ""];
        if (tipo) res.setHeader("Content-Type", tipo);
    },
};
