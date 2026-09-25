import type { Notificacion, TipoNotificacion } from "../../entities/notificacion.entity";

// Página de la campana: el frontend pide de a poco, lo más reciente primero
export interface FiltrosNotificacion {
    soloNoLeidas?: boolean;
    pagina: number;
    limite: number;
}

export interface INotificacionRepository {
    // Un solo INSERT para todo el lote: notificar a varios no se paga con varias idas a la base
    guardarVarias(notificaciones: Notificacion[]): Promise<void>;
    findById(id: string): Promise<Notificacion | null>;
    guardar(notificacion: Notificacion): Promise<Notificacion>;
    listarPorUsuario(
        usuarioId: string,
        filtros: FiltrosNotificacion,
    ): Promise<{ items: Notificacion[]; total: number }>;
    contarNoLeidas(usuarioId: string): Promise<number>;
    // Un solo UPDATE; devuelve cuántas quedaron marcadas
    marcarTodasLeidas(usuarioId: string): Promise<number>;
    // Evita repetir el mismo aviso mientras el usuario no lo haya leído
    existeNoLeida(usuarioId: string, tipo: TipoNotificacion, referenciaId: string): Promise<boolean>;
}

// Token de inyección PARA dependencias de NestJS
export const NOTIFICACION_REPOSITORY = "NOTIFICACION_REPOSITORY";
