import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { CargaMedio, IFirmadorMedios, VarianteMedio } from "../../../../domain/ports/out/firmador-medios.port";
import { TokenMedioError } from "../../../../domain/errors/vuelos.error";

@Injectable()
export class HmacMediosAdapter implements IFirmadorMedios {
    private readonly secreto: string;
    constructor(config: ConfigService) {
        this.secreto = config.getOrThrow<string>("VUELOS_URL_SECRET");
        if (
            !this.secreto.trim() ||
            [config.get<string>("JWT_SECRET"), config.get<string>("UPLOAD_URL_SECRET")].includes(this.secreto)
        )
            throw new Error("VUELOS_URL_SECRET es obligatoria y debe ser distinta de JWT_SECRET y UPLOAD_URL_SECRET.");
    }
    firmar(archivoId: string, variante: VarianteMedio, exp: number): string {
        const carga = Buffer.from(JSON.stringify({ archivoId, variante, exp })).toString("base64url");
        return `${carga}.${this.firma(carga).toString("base64url")}`;
    }
    verificar(token: string): CargaMedio {
        if (token.length > 1024) throw new TokenMedioError();
        const partes = token.split(".");
        if (partes.length !== 2 || !partes.every((p) => /^[A-Za-z0-9_-]+$/.test(p))) throw new TokenMedioError();
        const recibida = Buffer.from(partes[1], "base64url");
        if (
            recibida.toString("base64url") !== partes[1] ||
            Buffer.from(partes[0], "base64url").toString("base64url") !== partes[0]
        )
            throw new TokenMedioError();
        const esperada = this.firma(partes[0]);
        // Aun con tamaño inválido se ejecuta la comparación sobre 32 bytes.
        const comparable = recibida.length === 32 ? recibida : Buffer.alloc(32);
        if (!timingSafeEqual(esperada, comparable) || recibida.length !== 32) throw new TokenMedioError();
        let carga: CargaMedio;
        try {
            carga = JSON.parse(Buffer.from(partes[0], "base64url").toString("utf8")) as CargaMedio;
        } catch {
            throw new TokenMedioError();
        }
        if (
            !carga ||
            typeof carga.archivoId !== "string" ||
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(carga.archivoId) ||
            !["contenido", "miniatura"].includes(carga.variante) ||
            !Number.isSafeInteger(carga.exp)
        )
            throw new TokenMedioError();
        if (carga.exp <= Date.now()) throw new TokenMedioError(true);
        return carga;
    }
    private firma(texto: string) {
        return createHmac("sha256", this.secreto).update(texto).digest();
    }
}
