import { Logger } from "@nestjs/common";
import type { IConsultarElevacion } from "../../../../domain/ports/out/consultar-elevacion.port";

const URL_ELEVACION = "https://maps.googleapis.com/maps/api/elevation/json";
const TIMEOUT_MS = 3000;
// Un punto por finca: la caché no crece sin límite, se descarta lo más antiguo
const MAX_ENTRADAS_CACHE = 5000;

// API de Elevación de Google. La clave vive solo en el servidor y nunca se escribe en un log ni en una respuesta:
// por eso los errores se registran sin la URL (que lleva la clave) ni el mensaje original.
export class GoogleElevacionAdapter implements IConsultarElevacion {
    private readonly logger = new Logger(GoogleElevacionAdapter.name);
    private readonly cache = new Map<string, number>();

    constructor(
        private readonly apiKey: string,
        private readonly peticion: typeof fetch = fetch,
    ) {}

    async consultar(latitud: number, longitud: number): Promise<number | null> {
        try {
            if (!Number.isFinite(latitud) || !Number.isFinite(longitud)) return null;

            // 4 decimales ≈ 11 m: dos solicitudes del mismo lote comparten la consulta
            const clave = `${latitud.toFixed(4)},${longitud.toFixed(4)}`;
            const guardada = this.cache.get(clave);
            if (guardada !== undefined) return guardada;

            const url = `${URL_ELEVACION}?locations=${encodeURIComponent(clave)}&key=${encodeURIComponent(this.apiKey)}`;
            const respuesta = await this.peticion(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
            if (!respuesta.ok) return this.fallo(`HTTP ${respuesta.status}`);

            const cuerpo = (await respuesta.json()) as {
                status?: string;
                results?: { elevation?: unknown }[];
            };
            const elevacion = cuerpo.results?.[0]?.elevation;
            if (cuerpo.status !== "OK" || typeof elevacion !== "number" || !Number.isFinite(elevacion)) {
                return this.fallo(`estado ${String(cuerpo.status)}`);
            }

            const metros = Math.round(elevacion * 100) / 100;
            if (this.cache.size >= MAX_ENTRADAS_CACHE) {
                const masAntigua = this.cache.keys().next().value;
                if (masAntigua !== undefined) this.cache.delete(masAntigua);
            }
            this.cache.set(clave, metros);

            return metros;
        } catch (error) {
            // Timeout, red caída o JSON inválido. Solo el tipo de error: su mensaje puede traer la URL con la clave
            return this.fallo(error instanceof Error ? error.name : "error desconocido");
        }
    }

    private fallo(motivo: string): null {
        this.logger.warn(`No se pudo consultar la elevación (${motivo}).`);
        return null;
    }
}
