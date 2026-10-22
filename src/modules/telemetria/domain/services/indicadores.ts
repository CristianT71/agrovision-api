import { resolverVentana as resolverVentanaComun, type VentanaTiempo } from "../../../../common/utils/ventana-tiempo";

// La validación de la ventana es común con el tablero de resoluciones (solicitudes)
export { MAX_DIAS_VENTANA, type VentanaTiempo } from "../../../../common/utils/ventana-tiempo";

export const DIAS_POR_DEFECTO = 7;

// RF-06.1: métricas en ventanas de tiempo dinámicas, con un tope para no barrer toda la tabla
export function resolverVentana(desde: Date | undefined, hasta: Date | undefined, ahora: Date): VentanaTiempo {
    return resolverVentanaComun(desde, hasta, ahora, DIAS_POR_DEFECTO);
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
