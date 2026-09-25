import type { ArchivoParaGuardar } from "../../../../../common/almacenamiento/almacenamiento.port";
import type { AdjuntoMensaje, TipoAdjunto } from "../../entities/adjunto-mensaje.entity";
import type { AutorTipo } from "../../entities/mensaje.entity";

// Quien usa el canal, tal como llega del token (usuarios.id + rol)
export interface Actor {
    usuarioId: string;
    rol: string;
}

// Datos del adjunto que se muestran al cliente: la ruta interna nunca sale de la API
export interface ResumenAdjunto {
    id: string;
    nombreArchivo: string;
    tipoMime: string;
    tamanoBytes: number;
    tipo: TipoAdjunto;
}

export interface MensajeVista {
    id: string;
    solicitudId: string;
    autorId: string;
    autorTipo: AutorTipo;
    contenido: string | null;
    fecha: Date;
    leido: boolean;
    adjuntos: ResumenAdjunto[];
}

export interface EnviarMensajeCommand {
    actor: Actor;
    solicitudId: string;
    contenido?: string;
    archivos: ArchivoParaGuardar[];
}

// RF-08.6: total y desglose de mensajes sin leer del actor
export interface ResumenPendientes {
    total: number;
    porSolicitud: { solicitudId: string; pendientes: number }[];
}

export interface IEnviarMensajeUseCase {
    ejecutar(comando: EnviarMensajeCommand): Promise<MensajeVista>;
}

export interface IListarMensajesUseCase {
    ejecutar(consulta: { actor: Actor; solicitudId: string }): Promise<MensajeVista[]>;
}

export interface IMarcarMensajesLeidosUseCase {
    ejecutar(comando: { actor: Actor; solicitudId: string }): Promise<{ marcados: number }>;
}

export interface IContarMensajesPendientesUseCase {
    ejecutar(consulta: { actor: Actor }): Promise<ResumenPendientes>;
}

export interface IDescargarAdjuntoMensajeUseCase {
    ejecutar(consulta: {
        actor: Actor;
        solicitudId: string;
        mensajeId: string;
        adjuntoId: string;
    }): Promise<{ adjunto: AdjuntoMensaje; contenido: Buffer }>;
}
