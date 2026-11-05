// Reglas de asignación que configura el administrador (Ajustes > Operación de casos)
export interface PoliticaAsignacion {
    // RF-08: reparte los casos nuevos al agrónomo con menor carga
    asignacionAutomatica: boolean;
    // RF-08.4: casos en curso por agrónomo; null = sin límite
    cargaMaxima: number | null;
}

export interface IPoliticaAsignacion {
    obtener(): Promise<PoliticaAsignacion>;
}

export const POLITICA_ASIGNACION = "POLITICA_ASIGNACION";
