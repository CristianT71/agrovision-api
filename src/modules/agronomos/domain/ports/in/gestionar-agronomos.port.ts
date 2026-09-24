import type { Agronomo } from "../../entities/agronomo.entity";
import type { DocumentoAcreditacion } from "../../entities/documento-acreditacion.entity";
import type { FiltrosAgronomo } from "../out/agronomo.repository";

// Transiciones que el administrador puede aplicar sobre un agrónomo (RF-10.5)
export type AccionEstadoAgronomo = "validar" | "desactivar" | "reactivar";

// Datos del documento que se muestran al administrador: la ruta interna nunca sale de la API
export interface ResumenDocumento {
    id: string;
    nombreOriginal: string;
    tipoMime: string;
    tamanoBytes: number;
    fechaSubida: Date;
}

export interface AgronomoConCarga extends Omit<Agronomo, "validar" | "desactivar" | "reactivar" | "puedeRecibirCasos"> {
    // RF-08.4: solicitudes en curso asignadas al agrónomo
    casosActivos: number;
}

export interface DetalleAgronomo extends AgronomoConCarga {
    documentos: ResumenDocumento[];
}

export interface IListarAgronomosUseCase {
    ejecutar(filtros: FiltrosAgronomo): Promise<AgronomoConCarga[]>;
}

export interface IObtenerAgronomoUseCase {
    ejecutar(criterio: { id: string } | { usuarioId: string }): Promise<DetalleAgronomo>;
}

export interface ICambiarEstadoAgronomoUseCase {
    ejecutar(comando: { agronomoId: string; accion: AccionEstadoAgronomo }): Promise<Agronomo>;
}

export interface IDescargarDocumentoAgronomoUseCase {
    ejecutar(consulta: {
        agronomoId: string;
        documentoId: string;
    }): Promise<{ documento: DocumentoAcreditacion; contenido: Buffer }>;
}
