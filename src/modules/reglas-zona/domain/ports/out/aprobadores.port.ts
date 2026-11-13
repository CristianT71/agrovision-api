import type { Aprobador } from "../../entities/regla-zona";

export const APROBADORES_REGLAS_ZONA = "APROBADORES_REGLAS_ZONA";

export interface IAprobadoresReglasZona {
    // Datos profesionales de la cuenta si es un agrónomo validado (estado activo); null en otro caso.
    agronomoValidado(usuarioId: string): Promise<Aprobador | null>;
}
