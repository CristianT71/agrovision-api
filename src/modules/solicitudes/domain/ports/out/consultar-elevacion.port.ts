// Altitud sobre el nivel del mar de un punto. Nunca lanza: ante cualquier fallo (red, cuota, clave inválida,
// sin proveedor configurado) devuelve null y quien consulta decide qué hacer sin ella.
export interface IConsultarElevacion {
    consultar(latitud: number, longitud: number): Promise<number | null>;
}

export const CONSULTAR_ELEVACION = "CONSULTAR_ELEVACION";
