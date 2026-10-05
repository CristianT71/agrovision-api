// Avisos que genera el ciclo de vida de una solicitud (RF-02.5)
export interface INotificadorSolicitudes {
    // agronomoUsuarioId es la cuenta de login del agrónomo, no su id de agrónomo
    notificarAsignacion(datos: { solicitudId: string; agronomoUsuarioId: string }): Promise<void>;
}

// Token de inyección PARA dependencias de NestJS
export const NOTIFICADOR_SOLICITUDES = "NOTIFICADOR_SOLICITUDES";
