import type { FilaRegla } from "../entities/regla-zona";

// Tabla de EJEMPLO usada por las pruebas (la misma de las semillas v1 de la migración CrearReglasZona); no es un criterio calibrado.
export const FILAS_EJEMPLO: FilaRegla[] = [
    { orden: 1, sevMax: 10, incMax: 20, radioMinM: 0, radioMaxM: 3 },
    { orden: 2, sevMax: 30, incMax: 40, radioMinM: 3, radioMaxM: 8 },
    { orden: 3, sevMax: 60, incMax: 70, radioMinM: 8, radioMaxM: 15 },
    { orden: 4, sevMax: 100, incMax: 100, radioMinM: 15, radioMaxM: 30 },
];
