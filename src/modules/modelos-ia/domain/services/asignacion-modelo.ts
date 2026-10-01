import { createHash } from "node:crypto";
import type { ModeloIa } from "../entities/modelo-ia.entity";
import { compararVersiones, leerVersion } from "./versiones";

// Cubeta 0-99 derivada del hash del deviceId, nunca de un sorteo: un dispositivo que cae en el
// canario sigue en él entre consultas, y así un cambio en las métricas de campo se puede atribuir
// a la versión del modelo y no al ruido (ModelChannel en la app, §8.4).
export function cubetaDispositivo(deviceId: string): number {
    return createHash("sha256").update(deviceId).digest().readUInt32BE(0) % 100;
}

// El servidor decide qué versión le toca a cada dispositivo; la app solo obedece (§8.2).
// El canario solo se ofrece si la app instalada lo soporta: si no, ese teléfono sigue en producción.
export function resolverModeloParaDispositivo(
    vigentes: { canario: ModeloIa | null; produccion: ModeloIa | null },
    dispositivo: { deviceId: string; appVersion: string },
): ModeloIa | null {
    const { canario, produccion } = vigentes;

    if (canario && canario.porcentajeCanario !== null && !canario.killSwitch) {
        const enMuestra = cubetaDispositivo(dispositivo.deviceId) < canario.porcentajeCanario;
        const app = leerVersion(dispositivo.appVersion);
        const minima = leerVersion(canario.versionMinApp);
        const appCompatible = app !== null && minima !== null && compararVersiones(app, minima) >= 0;

        if (enMuestra && appCompatible) return canario;
    }

    // Una producción con kill-switch también se entrega: es la señal para que el teléfono se revierta
    return produccion;
}
