import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { IFirmadorUrlsSubida } from "../../../../domain/ports/out/firmador-urls-subida.port";

// Una hora alcanza para que la app suba sus fotos; si vence, reenviar el lote da URLs nuevas
export const VIGENCIA_URL_SUBIDA_MS = 60 * 60 * 1000;

interface CargaToken {
    fotoId: string;
    exp: number;
}

// Token = base64url({ fotoId, exp }) + "." + base64url(HMAC-SHA256 de lo anterior)
@Injectable()
export class HmacFirmadorUrlsSubidaAdapter implements IFirmadorUrlsSubida {
    private readonly secreto: string;
    private readonly urlBase: string;

    constructor(configService: ConfigService) {
        // Sin valor por defecto: con un secreto conocido cualquiera podría subir archivos
        this.secreto = configService.getOrThrow<string>("UPLOAD_URL_SECRET");
        const urlPublica =
            configService.get<string>("API_PUBLIC_URL") ?? `http://localhost:${process.env.PORT ?? 3000}`;
        this.urlBase = `${urlPublica.replace(/\/+$/, "")}/api/v1/uploads`;
    }

    firmar(fotoId: string): string {
        const carga: CargaToken = { fotoId, exp: Date.now() + VIGENCIA_URL_SUBIDA_MS };
        const cargaCodificada = Buffer.from(JSON.stringify(carga)).toString("base64url");

        return `${this.urlBase}/${cargaCodificada}.${this.firmarTexto(cargaCodificada)}`;
    }

    verificar(token: string): string | null {
        const partes = token.split(".");
        if (partes.length !== 2) return null;

        const [cargaCodificada, firma] = partes;
        const recibida = Buffer.from(firma, "base64url");
        const esperada = Buffer.from(this.firmarTexto(cargaCodificada), "base64url");

        // Comparación en tiempo constante: no filtra cuántos bytes de la firma acertó
        if (recibida.length !== esperada.length || !timingSafeEqual(recibida, esperada)) return null;

        let carga: Partial<CargaToken>;
        try {
            carga = JSON.parse(Buffer.from(cargaCodificada, "base64url").toString("utf8")) as Partial<CargaToken>;
        } catch {
            return null;
        }

        if (typeof carga.fotoId !== "string" || typeof carga.exp !== "number") return null;
        if (carga.exp <= Date.now()) return null;

        return carga.fotoId;
    }

    private firmarTexto(texto: string): string {
        return createHmac("sha256", this.secreto).update(texto).digest("base64url");
    }
}
