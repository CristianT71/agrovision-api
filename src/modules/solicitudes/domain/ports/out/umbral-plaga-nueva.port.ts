// RF-06.7: casos de "Plaga nueva" en una semana que disparan la alerta de reentrenamiento.
// Lo configura el administrador en Ajustes > Operación de casos.
export interface IUmbralPlagaNueva {
    obtener(): Promise<number>;
}

export const UMBRAL_PLAGA_NUEVA = "UMBRAL_PLAGA_NUEVA";
