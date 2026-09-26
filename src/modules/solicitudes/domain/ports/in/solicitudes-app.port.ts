import type { Cultivo, Organo } from "../../entities/solicitud.entity";
import type { AnguloFoto } from "../../entities/foto-solicitud.entity";
import type { ArchivoSubido } from "../../../../../common/almacenamiento/validar-archivo";

// NOTA: las respuestas usan los nombres en inglés del contrato que ya tiene la app móvil
// (Kotlin). No se traducen: la app las deserializa tal cual.

export const MAX_SOLICITUDES_POR_LOTE = 20;

export interface SolicitudAppEntrada {
    idCliente: string;
    capturaId: string | null;
    cultivo: Cultivo;
    organo: Organo;
    nota: string | null;
    // Epoch en milisegundos, como lo envía la app
    creadaEn: number;
    ubicacion: { latitud: number; longitud: number; precisionMetros: number | null } | null;
    fotos: { idCliente: string; angulo: AnguloFoto }[];
}

export interface RecibirLoteCommand {
    // Usuario autenticado: el productor se resuelve desde el token, nunca desde el cuerpo
    usuarioId: string;
    solicitudes: SolicitudAppEntrada[];
}

export type EstadoRecepcionApp = "accepted" | "duplicate" | "rejected";

export interface ResultadoSolicitudApp {
    id: string;
    serverId: string | null;
    status: EstadoRecepcionApp;
    // Siempre null: la app sube cada foto a su propia URL de imageUploads
    uploadUrl: string | null;
    reason: string | null;
    imageUploads: { imageId: string; uploadUrl: string }[] | null;
}

export interface IRecibirLoteSolicitudesUseCase {
    ejecutar(comando: RecibirLoteCommand): Promise<{ results: ResultadoSolicitudApp[] }>;
}

export interface SubirFotoCommand {
    token: string;
    archivo: ArchivoSubido;
}

export interface ISubirFotoSolicitudUseCase {
    ejecutar(comando: SubirFotoCommand): Promise<void>;
}
