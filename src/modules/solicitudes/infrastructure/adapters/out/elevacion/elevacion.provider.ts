import { Logger, type Provider } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CONSULTAR_ELEVACION, type IConsultarElevacion } from "../../../../domain/ports/out/consultar-elevacion.port";
import { GoogleElevacionAdapter } from "./google-elevacion.adapter";
import { SinElevacionAdapter } from "./sin-elevacion.adapter";

// ELEVATION_PROVIDER=google|none. Sin la clave, google se degrada a none con un aviso (sin exponer la clave).
export const elevacionProvider: Provider = {
    provide: CONSULTAR_ELEVACION,
    inject: [ConfigService],
    useFactory: (config: ConfigService): IConsultarElevacion => {
        const proveedor = (config.get<string>("ELEVATION_PROVIDER") ?? "none").trim().toLowerCase();
        if (proveedor !== "google") return new SinElevacionAdapter();

        const clave = config.get<string>("GOOGLE_ELEVATION_API_KEY")?.trim();
        if (!clave) {
            new Logger("Elevacion").warn(
                "ELEVATION_PROVIDER=google sin GOOGLE_ELEVATION_API_KEY: se desactiva la elevación.",
            );
            return new SinElevacionAdapter();
        }

        return new GoogleElevacionAdapter(clave);
    },
};
