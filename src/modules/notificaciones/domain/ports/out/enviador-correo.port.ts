// Salida de correo del sistema. Quien notifica no sabe si el mensaje sale por Gmail, otro SMTP o la consola.
export interface IEnviadorCorreo {
    enviar(destino: string, asunto: string, texto: string): Promise<void>;
}

// Token de inyección PARA dependencias de NestJS
export const ENVIADOR_CORREO = "ENVIADOR_CORREO";
