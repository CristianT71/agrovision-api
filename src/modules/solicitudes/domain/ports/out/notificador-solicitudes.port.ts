// Avisos que genera el ciclo de vida de una solicitud (RF-02.5)
export interface INotificadorSolicitudes {
    // agronomoUsuarioId es la cuenta de login del agrónomo, no su id de agrónomo
    notificarAsignacion(datos: { solicitudId: string; agronomoUsuarioId: string }): Promise<void>;
    // RF-06.7: la alerta sale una vez por episodio; ¿ya se emitió alguna desde esa fecha?
    hayAlertaPlagasDesde(desde: Date): Promise<boolean>;
    // RF-06.7, RF-02.5: avisa a todos los administradores activos
    notificarAlertaPlagas(datos: { casos: number; umbral: number }): Promise<void>;
}

// Token de inyección PARA dependencias de NestJS
export const NOTIFICADOR_SOLICITUDES = "NOTIFICADOR_SOLICITUDES";
