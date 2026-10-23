// Lectura de las variables que ajustan el servidor HTTP según dónde se despliegue

const ORIGEN_POR_DEFECTO = "http://localhost:5173";

// CORS_ORIGINS="https://panel.ejemplo.com, http://localhost:5173". El navegador manda el origen sin
// barra final: se quita para que "https://x.dev/" y "https://x.dev" sean el mismo origen.
export function leerOrigenesCors(valor: string | undefined): string[] {
    const origenes = (valor ?? "")
        .split(",")
        .map((origen) => origen.trim().replace(/\/+$/, ""))
        .filter(Boolean);

    return origenes.length > 0 ? origenes : [ORIGEN_POR_DEFECTO];
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
