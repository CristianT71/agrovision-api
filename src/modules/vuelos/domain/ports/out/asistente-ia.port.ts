export const ASISTENTE_IA = "ASISTENTE_IA";

export interface MensajeAsistente {
    vueloId: string;
    sessionId: string;
    chatInput: string;
}

export interface InformePdf {
    contenido: Buffer;
}

// Puerto hacia el motor del asistente (n8n). La respuesta del chat se devuelve tal cual la entrega el motor.
export interface IAsistenteIa {
    conversar(mensaje: MensajeAsistente): Promise<unknown>;
    descargarInforme(codigo: string): Promise<InformePdf>;
}
