import { TIPOS_RESULTADO } from "../entities/solicitud.entity";

// RF-06.7: cuántas "Plaga nueva" en una semana encienden la alerta de reentrenamiento
export const UMBRAL_PLAGA_NUEVA_SEMANAL = 5;
export const DIAS_SEMANA_ALERTA = 7;
// RF-06.5: el tablero mira los últimos 30 días si no se pide otra ventana
export const DIAS_VENTANA_RESOLUCIONES = 30;
// Casos de "Plaga nueva" que se listan en el tablero, los más recientes primero
export const MAX_CASOS_PLAGA_NUEVA = 50;

export const TIPO_PLAGA_NUEVA = "Plaga nueva";

const MS_POR_DIA = 86_400_000;

// Colombia no tiene horario de verano: siempre UTC-5
const FORMATO_DIA_COLOMBIA = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
});

// "YYYY-MM-DD" en hora de Colombia, igual que la serie de telemetría: una resolución a las 9 p. m.
// no puede caer en el día siguiente por estar en UTC
export function diaEnColombia(fecha: Date): string {
    const partes = Object.fromEntries(FORMATO_DIA_COLOMBIA.formatToParts(fecha).map((p) => [p.type, p.value]));
    return `${partes.year}-${partes.month}-${partes.day}`;
}

// Solo los días con casos, en orden cronológico
export function agruparPorDia(fechas: Date[]): { dia: string; casos: number }[] {
    const porDia = new Map<string, number>();
    for (const fecha of fechas) {
        const dia = diaEnColombia(fecha);
        porDia.set(dia, (porDia.get(dia) ?? 0) + 1);
    }

    return [...porDia.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([dia, casos]) => ({ dia, casos }));
}

// Una fila por cada tipo de resultado, con 0 si no hay. Un tipo que no esté en el catálogo
// (datos anteriores a él) se conserva al final para que la suma cuadre con el total.
export function completarPorTipo(filas: { tipo: string | null; casos: number }[]): { tipo: string; casos: number }[] {
    const casosPorTipo = new Map<string, number>();
    for (const { tipo, casos } of filas) {
        const clave = tipo ?? "Sin tipo";
        casosPorTipo.set(clave, (casosPorTipo.get(clave) ?? 0) + casos);
    }

    const conocidos = TIPOS_RESULTADO.map((tipo) => ({ tipo: tipo, casos: casosPorTipo.get(tipo) ?? 0 }));
    const otros = [...casosPorTipo.entries()]
        .filter(([tipo]) => !(TIPOS_RESULTADO as readonly string[]).includes(tipo))
        .map(([tipo, casos]) => ({ tipo, casos }));

    return [...conocidos, ...otros];
}

export function inicioSemanaAlerta(ahora: Date): Date {
    return new Date(ahora.getTime() - DIAS_SEMANA_ALERTA * MS_POR_DIA);
}

export function alcanzaUmbralPlagaNueva(casosUltimaSemana: number): boolean {
    return casosUltimaSemana >= UMBRAL_PLAGA_NUEVA_SEMANAL;
}
