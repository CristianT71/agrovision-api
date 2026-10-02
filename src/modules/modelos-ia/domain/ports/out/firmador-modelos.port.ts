// Firma Ed25519 del conjunto de artefactos que verifica la app antes de instalar (ArtifactInstaller.kt).
// La app calcula SHA-256(sha256 del modelo en hex minúsculas + etiquetas + calibración) y verifica la
// firma de ese digest con la clave pública embebida: sin la firma correcta descarta el modelo.
export interface IFirmadorModelos {
    // null cuando la API no tiene clave privada configurada
    firmarConjunto(datos: { sha256Modelo: string; etiquetas: Buffer; calibracion: Buffer }): string | null;
}

// Token de inyección PARA dependencias de NestJS
export const FIRMADOR_MODELOS = "FIRMADOR_MODELOS";
