import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { IFotosCatalogo } from "../../../../domain/ports/out/fotos-catalogo.port";
import { RUTA_FOTO_CATALOGO } from "../../../../../../common/almacenamiento/fotos-catalogo-publicas";

@Injectable()
export class UrlsFotosCatalogoAdapter implements IFotosCatalogo {
    constructor(private readonly config: ConfigService) {}

    urlPublica(fotoUrl: string): string | null {
        // No publicar enlaces externos, rutas privadas ni rutas que la API no sirve.
        if (!RUTA_FOTO_CATALOGO.test(fotoUrl)) return null;
        const base = this.config.get<string>("API_PUBLIC_URL");
        if (!base) throw new Error("API_PUBLIC_URL es obligatorio para publicar fotos del catálogo.");
        const url = new URL(fotoUrl, base);
        // http solo en desarrollo local (pruebas con adb reverse o emulador); en producción siempre https.
        const localDev =
            url.protocol === "http:" &&
            ["localhost", "127.0.0.1", "10.0.2.2"].includes(url.hostname) &&
            this.config.get<string>("NODE_ENV") !== "production";
        if ((url.protocol !== "https:" && !localDev) || url.username || url.password) {
            throw new Error("API_PUBLIC_URL debe ser una URL HTTPS pública sin credenciales para el catálogo.");
        }
        return url.toString();
    }
}
