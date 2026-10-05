// Avisos al agrónomo cuando cambia su acceso al contacto del productor (RF-02.5)
export interface INotificadorPermisos {
    // agronomoUsuarioId es la cuenta de login del agrónomo, no su id de agrónomo
    notificarPermisoOtorgado(datos: { solicitudId: string; agronomoUsuarioId: string }): Promise<void>;
    notificarPermisoRevocado(datos: { solicitudId: string; agronomoUsuarioId: string }): Promise<void>;
}

// Token de inyección PARA dependencias de NestJS
export const NOTIFICADOR_PERMISOS = "NOTIFICADOR_PERMISOS";
