// Lectura de las variables que ajustan el servidor HTTP según dónde se despliegue

import type { CorsOptionsDelegate } from "@nestjs/common/interfaces/external/cors-options.interface";

const ORIGEN_POR_DEFECTO = "http://localhost:5173";

// Rutas de solo lectura pensadas para que las consuman otros proyectos desde el navegador
const PREFIJO_CATALOGO_PUBLICO = "/api/public/v1/catalog";

// CORS_ORIGINS="https://panel.ejemplo.com, http://localhost:5173". El navegador manda el origen sin
// barra final: se quita para que "https://x.dev/" y "https://x.dev" sean el mismo origen.
export function leerOrigenesCors(valor: string | undefined): string[] {
    const origenes = (valor ?? "")
        .split(",")
        .map((origen) => origen.trim().replace(/\/+$/, ""))
        .filter(Boolean);

    return origenes.length > 0 ? origenes : [ORIGEN_POR_DEFECTO];
}

// El catálogo público lo consumen páginas de cualquier origen (la wiki de otros grupos): su CORS queda
// abierto, pero solo para lectura. El resto de la API conserva la lista CORS_ORIGINS.
export function esRutaPublicaAbierta(ruta: string): boolean {
    const camino = ruta.split("?")[0].replace(/\/+$/, "");

    return camino === PREFIJO_CATALOGO_PUBLICO || camino.startsWith(`${PREFIJO_CATALOGO_PUBLICO}/`);
}

// De la petición solo hace falta la ruta
interface PeticionCors {
    originalUrl?: string;
    url?: string;
}

export function crearOpcionesCors(origenes: string[]): CorsOptionsDelegate<PeticionCors> {
    return (req, callback) => {
        const ruta = req.originalUrl ?? req.url ?? "";

        if (esRutaPublicaAbierta(ruta)) {
            callback(null, { origin: "*", methods: ["GET", "HEAD", "OPTIONS"], maxAge: 86_400 });
            return;
        }

        // ETag expuesto para que el cliente de otro origen permitido lo lea y lo reenvíe en If-None-Match
        // (reglas de zona públicas). No abre más orígenes.
        callback(null, { origin: origenes, exposedHeaders: ["ETag"] });
    };
}

// TRUST_PROXY = cuántos proxies hay delante de la API (túnel, nginx, balanceador). Con 0 se usa la IP
// del socket. Sin esto, detrás de un proxy todos los usuarios comparten la IP del proxy y el límite
// de peticiones por IP castigaría a todos juntos.
export function leerSaltosProxy(valor: string | undefined): number {
    if (valor === undefined || valor.trim() === "") return 0;

    const saltos = Number(valor);
    if (!Number.isInteger(saltos) || saltos < 0 || saltos > 5) {
        throw new Error("TRUST_PROXY debe ser un entero entre 0 y 5 (cantidad de proxies delante de la API).");
    }

    return saltos;
}
