import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, createPrivateKey, sign, type KeyObject } from "node:crypto";
import type { IFirmadorModelos } from "../../../../domain/ports/out/firmador-modelos.port";

// Firma con la clave privada Ed25519 de MODEL_SIGNING_PRIVATE_KEY (PKCS#8 DER en Base64).
// Es opcional para que la API arranque sin ella: los modelos sin firma se pueden subir y probar
// internamente, pero nunca publicarse a los dispositivos.
@Injectable()
export class Ed25519FirmadorModelosAdapter implements IFirmadorModelos {
    private readonly logger = new Logger(Ed25519FirmadorModelosAdapter.name);
    private readonly clave: KeyObject | null;

    constructor(configService: ConfigService) {
        this.clave = this.cargarClave(configService.get<string>("MODEL_SIGNING_PRIVATE_KEY"));
    }

    firmarConjunto(datos: { sha256Modelo: string; etiquetas: Buffer; calibracion: Buffer }): string | null {
        if (!this.clave) return null;

        // Mismo digest que arma la app (ArtifactInstaller.kt, paso 4)
        const digest = createHash("sha256")
            .update(datos.sha256Modelo.toLowerCase(), "utf8")
            .update(datos.etiquetas)
            .update(datos.calibracion)
            .digest();

        // Ed25519 no usa un algoritmo de hash aparte: el primer argumento va en null
        return sign(null, digest, this.clave).toString("base64");
    }

    private cargarClave(valor: string | undefined): KeyObject | null {
        if (!valor?.trim()) {
            this.logger.warn("MODEL_SIGNING_PRIVATE_KEY no está configurada: los modelos se guardarán sin firma.");
            return null;
        }

        const clave = createPrivateKey({ key: Buffer.from(valor.trim(), "base64"), format: "der", type: "pkcs8" });
        if (clave.asymmetricKeyType !== "ed25519") {
            throw new Error("MODEL_SIGNING_PRIVATE_KEY debe ser una clave privada Ed25519 (PKCS#8 en Base64).");
        }

        return clave;
    }
}
