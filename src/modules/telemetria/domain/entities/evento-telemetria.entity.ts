import { ReglaNegocioError } from "../../../../common/errors/regla-negocio.error";

// Los tres eventos que registra la app (TelemetryRecorder en coffeApp-mobile)
export const TIPOS_EVENTO = ["scan", "correction", "model_update"] as const;
export type TipoEvento = (typeof TIPOS_EVENTO)[number];

// Resultados de la compuerta de la app (GateOutcome). Solo IDENTIFIED es un reconocimiento.
export const RESULTADOS_ESCANEO = ["IDENTIFIED", "UNCERTAIN", "OOD", "QUALITY_REJECTED"] as const;
export type ResultadoEscaneo = (typeof RESULTADOS_ESCANEO)[number];

export interface DatosEvento {
    tipo: TipoEvento;
    instalacionId: string | null;
    versionApp: string | null;
    ocurridoEn: Date;
    // scan y correction
    versionModelo: string | null;
    // scan
    resultado: ResultadoEscaneo | null;
    confianza: number | null;
    latenciaMs: number | null;
    delegado: string | null;
    // correction
    claseOrigen: string | null;
    claseDestino: string | null;
    // model_update
    versionOrigen: string | null;
    versionDestino: string | null;
    exito: boolean | null;
}

// Telemetría de campo anónima (RF-06): no guarda productor ni ubicación
export class EventoTelemetria {
    private constructor(
        public readonly id: string,
        public readonly datos: DatosEvento,
        public readonly recibidoEn: Date,
    ) {}

    public static reconstruir(id: string, datos: DatosEvento, recibidoEn: Date): EventoTelemetria {
        return new EventoTelemetria(id, datos, recibidoEn);
    }

    // La app envía un mapa plano de textos (Map<String, String>): aquí se interpreta y valida
    public static desdeMapa(id: string, mapa: Record<string, unknown>, ahora: Date): EventoTelemetria {
        const tipo = texto(mapa, "event", 20);
        if (!tipo || !(TIPOS_EVENTO as readonly string[]).includes(tipo)) {
            throw new ReglaNegocioError("El evento debe ser scan, correction o model_update.");
        }

        const ocurridoEn = fecha(mapa, "occurredAt") ?? ahora;
        // Un reloj de celular muy adelantado no puede ensuciar las ventanas de tiempo
        if (ocurridoEn.getTime() > ahora.getTime() + 5 * 60_000) {
            throw new ReglaNegocioError("La fecha del evento está en el futuro.");
        }

        const datos: DatosEvento = {
            tipo: tipo as TipoEvento,
            instalacionId: texto(mapa, "installationId", 64),
            versionApp: texto(mapa, "appVersion", 20),
            ocurridoEn,
            versionModelo: null,
            resultado: null,
            confianza: null,
            latenciaMs: null,
            delegado: null,
            claseOrigen: null,
            claseDestino: null,
            versionOrigen: null,
            versionDestino: null,
            exito: null,
        };

        if (datos.tipo === "scan") {
            datos.versionModelo = obligatorio(mapa, "modelVersion", 30);
            const resultado = obligatorio(mapa, "outcome", 30);
            if (!(RESULTADOS_ESCANEO as readonly string[]).includes(resultado)) {
                throw new ReglaNegocioError("outcome no es un resultado de escaneo válido.");
            }
            datos.resultado = resultado as ResultadoEscaneo;
            datos.confianza = numero(mapa, "confidence", 0, 1);
            datos.latenciaMs = numero(mapa, "latencyMillis", 0, 600_000, true);
            datos.delegado = texto(mapa, "delegate", 20);
        }

        if (datos.tipo === "correction") {
            datos.versionModelo = obligatorio(mapa, "modelVersion", 30);
            datos.claseOrigen = texto(mapa, "fromClassId", 100);
            datos.claseDestino = obligatorio(mapa, "toClassId", 100);
        }

        if (datos.tipo === "model_update") {
            datos.versionOrigen = texto(mapa, "fromVersion", 30);
            datos.versionDestino = obligatorio(mapa, "toVersion", 30);
            const exito = texto(mapa, "success", 5);
            if (exito !== "true" && exito !== "false") {
                throw new ReglaNegocioError("success debe ser true o false.");
            }
            datos.exito = exito === "true";
        }

        return new EventoTelemetria(id, datos, ahora);
    }
}

// ---- Lectura del mapa: todo llega como texto ----

function texto(mapa: Record<string, unknown>, clave: string, max: number): string | null {
    const valor = mapa[clave];
    if (valor === undefined || valor === null) return null;
    if (typeof valor !== "string") throw new ReglaNegocioError(`${clave} debe ser texto.`);
    const limpio = valor.trim();
    if (!limpio) return null;
    if (limpio.length > max) throw new ReglaNegocioError(`${clave} supera ${max} caracteres.`);
    return limpio;
}

function obligatorio(mapa: Record<string, unknown>, clave: string, max: number): string {
    const valor = texto(mapa, clave, max);
    if (!valor) throw new ReglaNegocioError(`Falta ${clave}.`);
    return valor;
}

function numero(mapa: Record<string, unknown>, clave: string, min: number, max: number, entero = false): number | null {
    const valor = texto(mapa, clave, 20);
    if (valor === null) return null;
    const n = Number(valor);
    if (!Number.isFinite(n) || n < min || n > max || (entero && !Number.isInteger(n))) {
        throw new ReglaNegocioError(`${clave} no es un número válido.`);
    }
    return n;
}

function fecha(mapa: Record<string, unknown>, clave: string): Date | null {
    const valor = numero(mapa, clave, 0, Number.MAX_SAFE_INTEGER, true);
    return valor === null ? null : new Date(valor);
}
