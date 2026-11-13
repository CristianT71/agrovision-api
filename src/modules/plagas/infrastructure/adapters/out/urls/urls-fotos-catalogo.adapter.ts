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
        if (url.protocol !== "https:" || url.username || url.password) {
            throw new Error("API_PUBLIC_URL debe ser una URL HTTPS pública sin credenciales para el catálogo.");
        }
        return url.toString();
    }
}
