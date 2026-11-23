import type { FilaRegla } from "../entities/regla-zona";

// Primera fila (por orden) con severidad <= sevMax Y incidencia <= incMax; si ninguna cumple, la última.
// No es una fórmula científica: traduce el criterio experto de la tabla a un rango de radio.
export function aplicarRegla(filas: readonly FilaRegla[], severidadPct: number, incidenciaPct: number): FilaRegla {
    if (filas.length === 0) throw new Error("La regla no tiene filas.");
    const ordenadas = [...filas].sort((a, b) => a.orden - b.orden);
    return (
        ordenadas.find((f) => severidadPct <= f.sevMax && incidenciaPct <= f.incMax) ?? ordenadas[ordenadas.length - 1]
    );
}

// Plantas dentro de un círculo de radio r (m) con una densidad en plantas/ha (1 ha = 10 000 m²).
export function plantasEnRadio(radioM: number, plantasPorHa: number): number {
    return Math.round((Math.PI * radioM * radioM * plantasPorHa) / 10_000);
}
