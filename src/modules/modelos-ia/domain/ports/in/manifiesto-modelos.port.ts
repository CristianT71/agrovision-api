// Contrato de la app móvil (ModelManifestDto en Kotlin): los nombres en inglés no se cambian.

export const ARTEFACTOS = ["model", "labels", "calibration"] as const;
export type Artefacto = (typeof ARTEFACTOS)[number];

export interface ManifiestoModelo {
    version: string;
    // Nombre del enum ModelChannel de la app
    channel: "CANARY" | "PRODUCTION";
    minAppVersion: string;
    sizeBytes: number;
    sha256: string;
    signature: string;
    artifacts: { model: string; labels: string; calibration: string };
    releaseNotes: string;
    killSwitch: boolean;
}

export interface ConsultaManifiesto {
    deviceId: string;
    appVersion: string;
}

export interface IObtenerManifiestoUseCase {
    // null cuando no hay ningún modelo publicado: la app sigue con el de fábrica
    ejecutar(consulta: ConsultaManifiesto): Promise<ManifiestoModelo | null>;
}

export interface IDescargarArtefactoUseCase {
    ejecutar(consulta: {
        version: string;
        artefacto: Artefacto;
    }): Promise<{ contenido: Buffer; tipoMime: string; nombre: string }>;
}
