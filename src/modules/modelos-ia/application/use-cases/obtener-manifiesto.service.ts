import { Inject, Injectable } from "@nestjs/common";
import type {
    ConsultaManifiesto,
    IObtenerManifiestoUseCase,
    ManifiestoModelo,
} from "../../domain/ports/in/manifiesto-modelos.port";
import { MODELO_IA_REPOSITORY, type IModeloIaRepository } from "../../domain/ports/out/modelo-ia.repository";
import { URLS_ARTEFACTOS, type IUrlsArtefactos } from "../../domain/ports/out/urls-artefactos.port";
import { resolverModeloParaDispositivo } from "../../domain/services/asignacion-modelo";

// Endpoint público que la app consulta para saber qué modelo debe tener (actualización OTA)
@Injectable()
export class ObtenerManifiestoService implements IObtenerManifiestoUseCase {
    constructor(
        @Inject(MODELO_IA_REPOSITORY)
        private readonly modeloRepository: IModeloIaRepository,
        @Inject(URLS_ARTEFACTOS)
        private readonly urls: IUrlsArtefactos,
    ) {}

    async ejecutar(consulta: ConsultaManifiesto): Promise<ManifiestoModelo | null> {
        const [[canario], [produccion]] = await Promise.all([
            this.modeloRepository.findAll({ canal: "canario" }),
            this.modeloRepository.findAll({ canal: "produccion" }),
        ]);

        const modelo = resolverModeloParaDispositivo(
            { canario: canario ?? null, produccion: produccion ?? null },
            consulta,
        );

        // Solo llegan a canario o producción modelos firmados y completos (regla del pipeline)
        if (!modelo?.artefactos.firma) return null;

        return {
            version: modelo.version,
            channel: modelo.canal === "canario" ? "CANARY" : "PRODUCTION",
            minAppVersion: modelo.versionMinApp,
            sizeBytes: modelo.artefactos.tamanoBytes,
            sha256: modelo.artefactos.sha256,
            signature: modelo.artefactos.firma,
            artifacts: {
                model: this.urls.urlDe(modelo.version, "model"),
                labels: this.urls.urlDe(modelo.version, "labels"),
                calibration: this.urls.urlDe(modelo.version, "calibration"),
            },
            releaseNotes: modelo.notas ?? "",
            // RF-09.3: con esto la app vuelve a su modelo anterior sin descargar nada
            killSwitch: modelo.killSwitch,
        };
    }
}
