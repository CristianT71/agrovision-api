// La app envía la versión del modelo como texto; el inventario la identifica por id (RF-07.1).
// Las detecciones no administran modelos: solo los consultan.
export interface IConsultaModelos {
    obtenerIdPorVersion(version: string): Promise<string | null>;
}

// Token de inyección PARA dependencias de NestJS
export const CONSULTA_MODELOS = "CONSULTA_MODELOS";
