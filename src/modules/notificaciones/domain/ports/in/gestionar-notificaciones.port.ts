import type { TipoNotificacion, TipoReferencia } from "../../entities/notificacion.entity";

// Lo que otro módulo pide crear: el sistema es el único que genera notificaciones
export interface NuevaNotificacion {
    usuarioId: string;
    tipo: TipoNotificacion;
    titulo: string;
    descripcion: string;
    referenciaTipo?: TipoReferencia | null;
    referenciaId?: string | null;
}

// Sin usuarioId: siempre es el del propio usuario que consulta
export interface NotificacionVista {
    id: string;
    tipo: TipoNotificacion;
    titulo: string;
    descripcion: string;
    referenciaTipo: TipoReferencia | null;
    referenciaId: string | null;
    leida: boolean;
    fecha: Date;
}

export interface PaginaNotificaciones {
    items: NotificacionVista[];
    total: number;
    pagina: number;
    limite: number;
}

export interface ICrearNotificacionesUseCase {
    // Devuelve cuántas creó realmente
    ejecutar(datos: NuevaNotificacion[], opciones?: { evitarDuplicadasNoLeidas?: boolean }): Promise<number>;
    notificarRol(
        rol: string,
        datos: Omit<NuevaNotificacion, "usuarioId">,
        opciones?: { excluirUsuarioId?: string; evitarDuplicadasNoLeidas?: boolean },
    ): Promise<number>;
}

export interface IListarNotificacionesUseCase {
    ejecutar(consulta: {
        usuarioId: string;
        soloNoLeidas?: boolean;
        pagina: number;
        limite: number;
    }): Promise<PaginaNotificaciones>;
}

export interface IContarNoLeidasUseCase {
    ejecutar(consulta: { usuarioId: string }): Promise<{ total: number }>;
}

export interface IMarcarNotificacionLeidaUseCase {
    ejecutar(comando: { usuarioId: string; notificacionId: string }): Promise<NotificacionVista>;
}

export interface IMarcarTodasLeidasUseCase {
    ejecutar(comando: { usuarioId: string }): Promise<{ marcadas: number }>;
}
