// Versiones semánticas como las compara la app (SemanticVersion.kt): número a número.

export type Version = [number, number, number];

// Tolerante con sufijos de compilación ("2.1.0-debug"): solo cuentan los tres primeros números
export function leerVersion(texto: string | null | undefined): Version | null {
    const coincidencia = /^(\d+)\.(\d+)\.(\d+)/.exec(texto?.trim() ?? "");
    if (!coincidencia) return null;

    return [Number(coincidencia[1]), Number(coincidencia[2]), Number(coincidencia[3])];
}

// Negativo si a < b, cero si son iguales, positivo si a > b
export function compararVersiones(a: Version, b: Version): number {
    for (let i = 0; i < 3; i++) {
        if (a[i] !== b[i]) return a[i] - b[i];
    }
    return 0;
}
