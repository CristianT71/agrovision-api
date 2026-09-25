import { ReglaNegocioError } from "../../../../common/errors/regla-negocio.error";

// Motivos por los que el sistema avisa al usuario (RF-02.5). Por ahora solo se genera
// "mensaje_nuevo"; los demás quedan definidos para cuando solicitudes, agronomos y el
// tablero empiecen a notificar.
export type TipoNotificacion =
    "mensaje_nuevo" | "solicitud_asignada" | "solicitud_resuelta" | "cuenta_validada" | "alerta_plaga" | "sistema";

// A qué apunta la notificación para que el frontend lleve al usuario al caso o ficha
export type TipoReferencia = "solicitud" | "plaga" | "agronomo" | "productor";

export const MAX_TITULO = 150;
export const MAX_DESCRIPCION = 500;

// Aviso contextual dirigido a una sola cuenta (RF-02.5, RF-02.6)
export class Notificacion {
    constructor(
        public readonly id: string,
        public readonly usuarioId: string,
        public readonly tipo: TipoNotificacion,
        public readonly titulo: string,
        public readonly descripcion: string,
        public readonly referenciaTipo: TipoReferencia | null,
        public readonly referenciaId: string | null,
        public leida: boolean,
        public readonly fecha: Date,
    ) {}

    // Regla de Negocio (RF-02.5): una notificación siempre dice algo y, si apunta a algo,
    // lo hace con tipo e id completos
    public static crear(datos: {
        id: string;
        usuarioId: string;
        tipo: TipoNotificacion;
        titulo: string;
        descripcion: string;
        referenciaTipo?: TipoReferencia | null;
        referenciaId?: string | null;
    }): Notificacion {
        const titulo = datos.titulo?.trim() ?? "";
        const descripcion = datos.descripcion?.trim() ?? "";

        if (!titulo) {
            throw new ReglaNegocioError("La notificación debe tener un título.");
        }

        if (titulo.length > MAX_TITULO) {
            throw new ReglaNegocioError(`El título no puede superar ${MAX_TITULO} caracteres.`);
        }

        if (!descripcion) {
            throw new ReglaNegocioError("La notificación debe tener una descripción.");
        }

        if (descripcion.length > MAX_DESCRIPCION) {
            throw new ReglaNegocioError(`La descripción no puede superar ${MAX_DESCRIPCION} caracteres.`);
        }

        const referenciaTipo = datos.referenciaTipo ?? null;
        const referenciaId = datos.referenciaId ?? null;

        // Una referencia a medias no sirve para navegar: o están las dos partes o ninguna
        if ((referenciaTipo && !referenciaId) || (!referenciaTipo && referenciaId)) {
            throw new ReglaNegocioError("La referencia de la notificación necesita tipo e id juntos.");
        }

        return new Notificacion(
            datos.id,
            datos.usuarioId,
            datos.tipo,
            titulo,
            descripcion,
            referenciaTipo,
            referenciaId,
            false,
            new Date(),
        );
    }

    // RF-02.6: idempotente a propósito, el frontend puede repetir la petición sin romper nada
    public marcarLeida(): void {
        this.leida = true;
    }

    public perteneceA(usuarioId: string): boolean {
        return this.usuarioId === usuarioId;
    }
}
