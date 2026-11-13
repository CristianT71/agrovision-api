import type { FilaRegla } from "../entities/regla-zona";

export const MAX_FILAS = 12;
export const RADIO_MAXIMO_M = 500;

const esNumero = (v: number) => typeof v === "number" && Number.isFinite(v);

// Devuelve la lista de violaciones; vacía si la tabla cumple el contrato.
// Las filas se evalúan en el orden en que llegan: el orden declarado debe ser 1..n consecutivo.
export function validarFilas(filas: readonly FilaRegla[]): string[] {
    const errores: string[] = [];
    if (filas.length < 1 || filas.length > MAX_FILAS) {
        errores.push(`La tabla debe tener entre 1 y ${MAX_FILAS} filas.`);
        return errores;
    }
    filas.forEach((f, i) => {
        const n = i + 1;
        if (f.orden !== n) errores.push(`Fila ${n}: el orden debe ser consecutivo desde 1 (se esperaba ${n}).`);
        for (const [campo, valor] of [
            ["sevMax", f.sevMax],
            ["incMax", f.incMax],
        ] as const) {
            if (!esNumero(valor) || valor <= 0 || valor > 100)
                errores.push(`Fila ${n}: ${campo} debe estar en (0, 100].`);
        }
        for (const [campo, valor] of [
            ["radioMinM", f.radioMinM],
            ["radioMaxM", f.radioMaxM],
        ] as const) {
            if (!esNumero(valor) || valor < 0 || valor > RADIO_MAXIMO_M)
                errores.push(`Fila ${n}: ${campo} debe estar en [0, ${RADIO_MAXIMO_M}].`);
        }
        if (esNumero(f.radioMinM) && esNumero(f.radioMaxM) && f.radioMinM > f.radioMaxM)
            errores.push(`Fila ${n}: radioMinM no puede ser mayor que radioMaxM.`);
        if (i > 0) {
            const p = filas[i - 1];
            if (f.sevMax < p.sevMax) errores.push(`Fila ${n}: sevMax no puede ser menor que el de la fila anterior.`);
            if (f.incMax < p.incMax) errores.push(`Fila ${n}: incMax no puede ser menor que el de la fila anterior.`);
            if (f.radioMinM < p.radioMinM)
                errores.push(`Fila ${n}: radioMinM no puede ser menor que el de la fila anterior.`);
            if (f.radioMaxM < p.radioMaxM)
                errores.push(`Fila ${n}: radioMaxM no puede ser menor que el de la fila anterior.`);
        }
    });
    const ultima = filas[filas.length - 1];
    if (ultima.sevMax !== 100 || ultima.incMax !== 100)
        errores.push("La última fila debe cubrir sevMax 100 e incMax 100.");
    return errores;
}
