import { ReglaNegocioError } from "../../../../common/errors/regla-negocio.error";
import type { Cultivo, Organo } from "../../../solicitudes/domain/entities/solicitud.entity";
import { categorizar, type Categoria, type ResultadoCompuerta } from "../services/categoria-biologica";

// Margen para relojes de teléfono mal configurados: más allá, la fecha no es creíble
const TOLERANCIA_FUTURO_MS = 24 * 60 * 60 * 1000;

// Rechazo de una captura del lote: el código corto viaja a la app como "reason"
export class CapturaInvalidaError extends ReglaNegocioError {
    constructor(
        public readonly codigo: string,
        mensaje: string,
    ) {
        super(mensaje);
        this.name = "CapturaInvalidaError";
    }
}

export interface DatosCaptura {
    id: string;
    idCliente: string;
    // Se copia el municipio: la detección conserva dónde estaba el productor al escanear
    productor: { id: string; municipio: string };
    modelo: { id: string | null; version: string };
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
    fecha: Date;
}

// Inferencia cruda del modelo en el teléfono (RF-07.1), tal como la envía la app
export class Deteccion {
    constructor(
        public readonly id: string,
        // Id que generó la app: hace idempotente el reenvío del lote
        public readonly idCliente: string,
        public readonly productorId: string,
        public readonly municipio: string,
        public readonly categoria: Categoria,
        public readonly clasePredicha: string | null,
        public readonly confianza: number | null,
        public readonly puntajeOod: number,
        public readonly resultadoCompuerta: ResultadoCompuerta,
        // null si la versión no está registrada en el inventario (p. ej. el modelo de fábrica)
        public readonly modeloId: string | null,
        public readonly modeloVersion: string,
        public readonly correccionProductor: string | null,
        public readonly confirmadaProductor: boolean,
        public readonly cultivo: Cultivo | null,
        public readonly organo: Organo | null,
        public readonly latitud: number | null,
        public readonly longitud: number | null,
        public readonly precisionMetros: number | null,
        public readonly embedding: string | null,
        public readonly fecha: Date,
        public readonly recibidaEn: Date,
        public readonly defectuosa: boolean,
    ) {}

    public static registrar(datos: DatosCaptura, ahora = new Date()): Deteccion {
        const { confianza, puntajeOod, ubicacion } = datos;

        if (confianza !== null && (!Number.isFinite(confianza) || confianza < 0 || confianza > 1)) {
            throw new CapturaInvalidaError("confianza_invalida", "La confianza debe estar entre 0 y 1.");
        }

        if (!Number.isFinite(puntajeOod)) {
            throw new CapturaInvalidaError("ood_invalido", "El puntaje fuera de distribución no es un número.");
        }

        // Una predicción aceptada por las compuertas siempre nombra su clase
        if (datos.resultadoCompuerta === "IDENTIFIED" && !datos.clasePredicha?.trim()) {
            throw new CapturaInvalidaError("clase_faltante", "Una captura identificada debe indicar su clase.");
        }

        if (Number.isNaN(datos.fecha.getTime()) || datos.fecha.getTime() > ahora.getTime() + TOLERANCIA_FUTURO_MS) {
            throw new CapturaInvalidaError("fecha_invalida", "La fecha de la captura no es válida.");
        }

        if (ubicacion && !Deteccion.esUbicacionValida(ubicacion)) {
            throw new CapturaInvalidaError("ubicacion_invalida", "La ubicación de la captura no es válida.");
        }

        return new Deteccion(
            datos.id,
            datos.idCliente,
            datos.productor.id,
            datos.productor.municipio,
            categorizar(datos.resultadoCompuerta, datos.clasePredicha),
            datos.clasePredicha?.trim() || null,
            confianza,
            puntajeOod,
            datos.resultadoCompuerta,
            datos.modelo.id,
            datos.modelo.version,
            datos.correccionProductor?.trim() || null,
            datos.confirmadaProductor,
            datos.cultivo,
            datos.organo,
            ubicacion?.latitud ?? null,
            ubicacion?.longitud ?? null,
            ubicacion?.precisionMetros ?? null,
            datos.embedding,
            datos.fecha,
            ahora,
            // Regla de Negocio (RF-07.4): confianza absoluta de cero = inferencia defectuosa o nula
            confianza === 0,
        );
    }

    private static esUbicacionValida(ubicacion: NonNullable<DatosCaptura["ubicacion"]>): boolean {
        const { latitud, longitud, precisionMetros } = ubicacion;
        return (
            Number.isFinite(latitud) &&
            Number.isFinite(longitud) &&
            latitud >= -90 &&
            latitud <= 90 &&
            longitud >= -180 &&
            longitud <= 180 &&
            (precisionMetros === null || (Number.isFinite(precisionMetros) && precisionMetros >= 0))
        );
    }
}
