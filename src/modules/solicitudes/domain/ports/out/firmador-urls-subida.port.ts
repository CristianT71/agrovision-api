// URLs de subida de un solo uso por foto: la URL misma es la autorización (no lleva JWT)
export interface IFirmadorUrlsSubida {
    // Devuelve la URL completa a la que la app hace PUT con los bytes de la foto
    firmar(fotoId: string): string;
    // Devuelve el id de la foto si el token es auténtico y no ha vencido; si no, null
    verificar(token: string): string | null;
}

// Token de inyección PARA dependencias de NestJS
export const FIRMADOR_URLS_SUBIDA = "FIRMADOR_URLS_SUBIDA";
