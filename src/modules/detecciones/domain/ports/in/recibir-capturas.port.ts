import type { Cultivo, Organo } from "../../../../solicitudes/domain/entities/solicitud.entity";
import type { ResultadoCompuerta } from "../../services/categoria-biologica";

// NOTA: las respuestas usan los nombres en inglés del contrato que ya tiene la app móvil
// (UploadBatchResponseDto en Kotlin). No se traducen: la app las deserializa tal cual.

export const MAX_CAPTURAS_POR_LOTE = 100;

export interface CapturaEntrada {
    idCliente: string;
    // Epoch en milisegundos, como lo envía la app
    capturadaEn: number;
    modeloVersion: string;
    clasePredicha: string | null;
    confianza: number | null;
    puntajeOod: number;
    resultadoCompuerta: ResultadoCompuerta;
    embedding: string | null;
    correccionProductor: string | null;
    confirmadaProductor: boolean;
    cultivo: Cultivo | null;
    organo: Organo | null;
    ubicacion: { latitud: number; longitud: number; precisionMetros: number | null } | null;
}

export interface RecibirCapturasCommand {
    // Usuario autenticado: el productor se resuelve desde el token, nunca desde el cuerpo
    usuarioId: string;
    capturas: CapturaEntrada[];
}

export interface ResultadoCapturaApp {
    id: string;
    serverId: string | null;
    status: "accepted" | "duplicate" | "rejected";
    // Por ahora siempre null: la API recibe solo los metadatos de la inferencia y la app
    // no sube la imagen de la captura
    uploadUrl: string | null;
    reason: string | null;
}

export interface IRecibirCapturasUseCase {
    ejecutar(comando: RecibirCapturasCommand): Promise<{ results: ResultadoCapturaApp[] }>;
}
