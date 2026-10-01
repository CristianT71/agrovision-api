import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { IUrlsArtefactos } from "../../../../domain/ports/out/urls-artefactos.port";
import type { Artefacto } from "../../../../domain/ports/in/manifiesto-modelos.port";

// Arma las URLs con la misma base pública que usan las subidas de fotos de la app (API_PUBLIC_URL)
@Injectable()
export class UrlsArtefactosAdapter implements IUrlsArtefactos {
    private readonly urlBase: string;

    constructor(configService: ConfigService) {
        const urlPublica =
            configService.get<string>("API_PUBLIC_URL") ?? `http://localhost:${process.env.PORT ?? 3000}`;
        this.urlBase = `${urlPublica.replace(/\/+$/, "")}/api/public/v1/models`;
    }

    urlDe(version: string, artefacto: Artefacto): string {
        return `${this.urlBase}/${encodeURIComponent(version)}/${artefacto}`;
    }
}
