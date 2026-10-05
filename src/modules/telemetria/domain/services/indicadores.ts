import { ReglaNegocioError } from "../../../../common/errors/regla-negocio.error";

export const DIAS_POR_DEFECTO = 7;
export const MAX_DIAS_VENTANA = 90;

export interface VentanaTiempo {
    desde: Date;
    hasta: Date;
}

// RF-06.1: métricas en ventanas de tiempo dinámicas, con un tope para no barrer toda la tabla
export function resolverVentana(desde: Date | undefined, hasta: Date | undefined, ahora: Date): VentanaTiempo {
    const fin = hasta ?? ahora;
    const inicio = desde ?? new Date(fin.getTime() - DIAS_POR_DEFECTO * 86_400_000);

    if (inicio.getTime() >= fin.getTime()) {
        throw new ReglaNegocioError("La fecha desde debe ser anterior a hasta.");
    }
    if (fin.getTime() - inicio.getTime() > MAX_DIAS_VENTANA * 86_400_000) {
        throw new ReglaNegocioError(`La ventana no puede superar ${MAX_DIAS_VENTANA} días.`);
    }
    return { desde: inicio, hasta: fin };
}

// Conteos crudos que devuelve la base de datos por versión de modelo
export interface ConteoModelo {
    versionModelo: string;
    escaneos: number;
    identificados: number;
    rechazadosPorCalidad: number;
    correcciones: number;
    latenciaPromedioMs: number | null;
}

export interface IndicadoresModelo extends ConteoModelo {
    noReconocidos: number;
    tasaNoReconocido: number | null;
    tasaCorreccion: number | null;
}

// Una foto borrosa es un problema de la cámara, no del modelo: los rechazos por calidad
// no cuentan como "no reconocido" ni entran en el denominador
export function calcularIndicadores(conteo: ConteoModelo): IndicadoresModelo {
    const evaluados = conteo.escaneos - conteo.rechazadosPorCalidad;
    const noReconocidos = evaluados - conteo.identificados;

    return {
        ...conteo,
        noReconocidos,
        tasaNoReconocido: evaluados > 0 ? redondear(noReconocidos / evaluados) : null,
        tasaCorreccion: conteo.identificados > 0 ? redondear(conteo.correcciones / conteo.identificados) : null,
    };
}

// Conteos de un día (YYYY-MM-DD en America/Bogota) para una versión de modelo
export type ConteoDiaModelo = Omit<ConteoModelo, "latenciaPromedioMs"> & { dia: string };

// RF-06.3: un punto de la serie diaria que dibujan las gráficas
export interface PuntoSerie {
    dia: string;
    versionModelo: string;
    escaneos: number;
    noReconocidos: number;
    tasaNoReconocido: number | null;
    correcciones: number;
}

// Misma regla que el resumen por modelo: los rechazos por calidad no cuentan como no reconocidos
export function calcularPuntoSerie(conteo: ConteoDiaModelo): PuntoSerie {
    const indicadores = calcularIndicadores({ ...conteo, latenciaPromedioMs: null });

    return {
        dia: conteo.dia,
        versionModelo: indicadores.versionModelo,
        escaneos: indicadores.escaneos,
        noReconocidos: indicadores.noReconocidos,
        tasaNoReconocido: indicadores.tasaNoReconocido,
        correcciones: indicadores.correcciones,
    };
}

export interface ConteoActualizacion {
    versionDestino: string;
    exitos: number;
    fallos: number;
}

// RF-06.4: éxitos y fallos de las actualizaciones OTA del modelo en los celulares
export function calcularTasaExito(conteo: ConteoActualizacion): ConteoActualizacion & { tasaExito: number | null } {
    const total = conteo.exitos + conteo.fallos;
    return { ...conteo, tasaExito: total > 0 ? redondear(conteo.exitos / total) : null };
}

function redondear(valor: number): number {
    return Math.round(valor * 10_000) / 10_000;
}
