import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import type {
    CatalogDeltaDto,
    ISincronizarCatalogoUseCase,
    PestDto,
} from "../../domain/ports/in/sincronizar-catalogo.port";
import {
    CATALOGO_REPOSITORY,
    type ICatalogoRepository,
    type FichaCatalogo,
} from "../../domain/ports/out/catalogo.repository";
import { FOTOS_CATALOGO, type IFotosCatalogo } from "../../domain/ports/out/fotos-catalogo.port";

function enumerado(valor: string): string {
    return valor
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toUpperCase();
}

// Lista explícita de campos: nunca serializar el agregado de administración.
export function aPestDto(ficha: FichaCatalogo, fotos: IFotosCatalogo): PestDto {
    const aval = ficha.aval;
    const aprobado =
        aval && aval.nombreAgronomo.trim() && aval.numeroTarjeta.trim() && Number.isFinite(aval.fechaAval.getTime());
    const imagen = ficha.fotoUrl ? fotos.urlPublica(ficha.fotoUrl) : null;
    return {
        id: ficha.catalogId,
        scientificName: ficha.nombreCientifico ?? "Sin binomio registrado",
        commonName: ficha.nombreComun,
        localSynonyms: [...ficha.sinonimos].sort(),
        crop: enumerado(ficha.cultivo),
        affectedOrgans: ficha.organosAfectados.map(enumerado).sort(),
        description: ficha.descripcion,
        recommendations: aprobado
            ? [
                  ...(ficha.medidasContencion.trim()
                      ? [{ kind: "CULTURAL", summary: "Medidas de contención", detail: ficha.medidasContencion }]
                      : []),
                  ...(ficha.protocoloQuimico?.trim()
                      ? [{ kind: "QUIMICO", summary: "Protocolo químico", detail: ficha.protocoloQuimico }]
                      : []),
              ]
            : [],
        images: imagen ? [imagen] : [],
        version: ficha.version,
        kind: enumerado(ficha.tipo),
        ...(aprobado
            ? {
                  approval: {
                      agronomistName: aval.nombreAgronomo,
                      licenseNumber: aval.numeroTarjeta,
                      approvedAt: aval.fechaAval.getTime(),
                  },
              }
            : {}),
    };
}

@Injectable()
export class SincronizarCatalogoService implements ISincronizarCatalogoUseCase {
    constructor(
        @Inject(CATALOGO_REPOSITORY) private readonly catalogo: ICatalogoRepository,
        @Inject(FOTOS_CATALOGO) private readonly fotos: IFotosCatalogo,
    ) {}

    async ejecutar(since?: number): Promise<CatalogDeltaDto> {
        const { fichas, deletedIds, serverTime } = await this.catalogo.leerDelta(since);
        if (since !== undefined && since > serverTime) {
            throw new BadRequestException("since no puede estar en el futuro.");
        }
        const upserted = fichas.map((ficha) => aPestDto(ficha, this.fotos)).sort((a, b) => a.id.localeCompare(b.id));
        deletedIds.sort();
        // El reloj no entra al hash: el mismo contenido debe producir el mismo ETag.
        const etag = `"${createHash("sha256").update(JSON.stringify({ upserted, deletedIds })).digest("hex")}"`;
        return { upserted, deletedIds, etag, serverTime };
    }
}
