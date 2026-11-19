import { Inject, Injectable, BadRequestException } from "@nestjs/common";
import type { ICorrelacionApp, CorrelacionAppVista } from "../../domain/ports/in/correlacion-app.port";
import {
    LECTURA_CORRELACION_APP,
    type ILecturaCorrelacionApp,
    type CajaGeografica,
} from "../../domain/ports/out/correlacion-app.port";
import { VUELOS_REPOSITORY, type IVuelosRepository } from "../../domain/ports/out/vuelos.repository";
import { VueloNoEncontradoError } from "../../domain/errors/vuelos.error";
import type { Json } from "../../domain/entities/vuelo";

function leerCaja(valor: Json | undefined): CajaGeografica | null {
    if (!valor || typeof valor !== "object" || Array.isArray(valor)) return null;
    const { sur, norte, oeste, este } = valor;
    if (![sur, norte, oeste, este].every((v) => typeof v === "number" && Number.isFinite(v))) return null;
    const caja = { sur, norte, oeste, este } as CajaGeografica;
    if (
        caja.sur < -90 ||
        caja.norte > 90 ||
        caja.sur > caja.norte ||
        caja.oeste < -180 ||
        caja.este > 180 ||
        caja.oeste > caja.este
    )
        return null;
    return caja;
}

// Aproximación conservadora WGS84; usa la latitud extrema para cubrir toda la caja.
function ampliar(caja: CajaGeografica, radioM: number): CajaGeografica {
    const deltaLat = radioM / 110_574;
    const sur = Math.max(-90, caja.sur - deltaLat);
    const norte = Math.min(90, caja.norte + deltaLat);
    const coseno = Math.cos((Math.max(Math.abs(sur), Math.abs(norte)) * Math.PI) / 180);
    const deltaLon = radioM === 0 ? 0 : Math.min(180, radioM / (111_319 * coseno));
    // Si se cruza el antimeridiano, el SQL admite límites fuera de [-180, 180].
    return { sur, norte, oeste: caja.oeste - deltaLon, este: caja.este + deltaLon };
}

@Injectable()
export class CorrelacionAppService implements ICorrelacionApp {
    constructor(
        @Inject(VUELOS_REPOSITORY) private readonly vuelos: IVuelosRepository,
        @Inject(LECTURA_CORRELACION_APP) private readonly lectura: ILecturaCorrelacionApp,
    ) {}
    async ejecutar(id: string, radioM = 300): Promise<CorrelacionAppVista> {
        if (!Number.isInteger(radioM) || radioM < 0 || radioM > 2000)
            throw new BadRequestException("radioM debe ser un entero entre 0 y 2000.");
        if (!(await this.vuelos.obtener(id))) throw new VueloNoEncontradoError();
        const resumenVuelo = (await this.vuelos.resumen([id]))[id];
        const caja = leerCaja(resumenVuelo?.caja);
        const captura = resumenVuelo?.primeraCapturaEn;
        const instante = typeof captura === "string" ? new Date(captura).getTime() : NaN;
        const fechaVuelo = Number.isFinite(instante) ? new Date(instante).toISOString() : null;
        const cajaAmpliada = caja ? ampliar(caja, radioM) : null;
        const limitaciones: string[] = [];
        if (!fechaVuelo) limitaciones.push("El vuelo no tiene fecha de captura: diferencia de días no disponible.");
        if (!caja) limitaciones.push("El vuelo no tiene caja geográfica: no se pueden buscar registros cercanos.");
        const lectura = cajaAmpliada
            ? await this.lectura.consultar(cajaAmpliada)
            : {
                  registros: [],
                  resumen: {
                      total: 0,
                      porOrigen: { deteccion: 0, solicitud: 0 },
                      porClase: [],
                      fechaMin: null,
                      fechaMax: null,
                  },
              };
        return {
            caja,
            cajaAmpliada,
            radioM,
            fechaVuelo,
            limitaciones,
            registros: lectura.registros.slice(0, 500).map((r) => ({
                ...r,
                // Días transcurridos, con fracción: conserva el signo incluso dentro del mismo día.
                diasDesdeVuelo: fechaVuelo && r.fecha ? (new Date(r.fecha).getTime() - instante) / 86_400_000 : null,
            })),
            truncado: lectura.resumen.total > 500,
            resumen: lectura.resumen,
        };
    }
}
