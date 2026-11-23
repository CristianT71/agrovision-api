import { Inject, Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import type { IReglasZonaPublicas, ReglaZonaPublica } from "../../domain/ports/in/reglas-zona.port";
import { REGLAS_ZONA_REPOSITORY, type IReglasZonaRepository } from "../../domain/ports/out/reglas-zona.repository";

// El ETag depende solo del contenido público: la misma versión activa produce siempre la misma etiqueta.
export function etagReglaPublica(regla: ReglaZonaPublica): string {
    return `"${createHash("sha256").update(JSON.stringify(regla)).digest("hex")}"`;
}

@Injectable()
export class ReglasZonaPublicasService implements IReglasZonaPublicas {
    constructor(@Inject(REGLAS_ZONA_REPOSITORY) private readonly repo: IReglasZonaRepository) {}

    async obtenerActiva(tipoEnfermedad: string) {
        const activa = await this.repo.obtenerActiva(tipoEnfermedad);
        if (!activa) return null;
        const regla: ReglaZonaPublica = {
            tipoEnfermedad: activa.tipoEnfermedad,
            version: activa.version,
            calibrada: activa.calibrada,
            filas: activa.filas
                .sort((a, b) => a.orden - b.orden)
                .map((f) => ({
                    orden: f.orden,
                    sevMax: f.sevMax,
                    incMax: f.incMax,
                    radioMinM: f.radioMinM,
                    radioMaxM: f.radioMaxM,
                })),
        };
        return { regla, etag: etagReglaPublica(regla) };
    }
}
