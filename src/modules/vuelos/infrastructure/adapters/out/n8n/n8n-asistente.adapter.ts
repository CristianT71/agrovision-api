import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { IAsistenteIa, InformePdf, MensajeAsistente } from "../../../../domain/ports/out/asistente-ia.port";
import {
    AsistenteNoConfiguradoError,
    AsistenteOcupadoError,
    InformeAsistenteError,
} from "../../../../domain/errors/vuelos.error";

// Cabecera con la que n8n reconoce a la API (credencial «Header Auth» de los webhooks 01 y 04).
export const CABECERA_SECRETO_N8N = "X-N8N-Secret";
export const SECRETO_N8N_MIN_CARACTERES = 32;
// Analizar un vuelo y redactar el informe puede pasar de un minuto; el panel espera 240 s.
export const ESPERA_CHAT_MS = 230_000;
export const ESPERA_INFORME_MS = 30_000;
const URL_N8N_POR_DEFECTO = "http://localhost:5679/";

const MENSAJES_INFORME: Record<400 | 404 | 410, string> = {
    400: "Enlace no válido.",
    404: "No se encontró el informe. Pide uno nuevo.",
    410: "El enlace venció. Pide un informe nuevo.",
};

// Único punto por el que la API habla con n8n. El secreto viaja solo de servidor a servidor: el navegador
// nunca ve la URL de n8n ni el secreto. Sin N8N_CHAT_SECRET el asistente responde 503 (n8n es opcional).
@Injectable()
export class N8nAsistenteAdapter implements IAsistenteIa {
    private readonly logger = new Logger(N8nAsistenteAdapter.name);
    private readonly secreto: string | null;
    private readonly base: string;

    constructor(config: ConfigService) {
        const secreto = config.get<string>("N8N_CHAT_SECRET")?.trim() || null;
        if (secreto && secreto.length < SECRETO_N8N_MIN_CARACTERES) {
            throw new Error(`N8N_CHAT_SECRET debe tener al menos ${SECRETO_N8N_MIN_CARACTERES} caracteres.`);
        }
        if (secreto && secreto === config.get<string>("N8N_API_KEY")?.trim()) {
            throw new Error("N8N_CHAT_SECRET debe ser distinta de N8N_API_KEY.");
        }
        const base = config.get<string>("N8N_WEBHOOK_URL")?.trim() || URL_N8N_POR_DEFECTO;
        let url: URL;
        try {
            url = new URL(base);
        } catch {
            throw new Error("N8N_WEBHOOK_URL no es una URL válida.");
        }
        if (url.protocol !== "http:" && url.protocol !== "https:") {
            throw new Error("N8N_WEBHOOK_URL debe usar http o https.");
        }
        this.secreto = secreto;
        this.base = url.href.endsWith("/") ? url.href : `${url.href}/`;
    }

    async conversar({ vueloId, sessionId, chatInput }: MensajeAsistente): Promise<unknown> {
        const respuesta = await this.llamar("webhook/asistente", ESPERA_CHAT_MS, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "sendMessage", sessionId, chatInput, vueloId }),
        });
        if (!respuesta.ok) {
            this.logger.warn(`n8n respondió ${respuesta.status} al chat.`);
            throw new AsistenteOcupadoError();
        }
        try {
            return (await respuesta.json()) as unknown;
        } catch {
            this.logger.warn("n8n devolvió una respuesta del chat que no es JSON.");
            throw new AsistenteOcupadoError();
        }
    }

    async descargarInforme(codigo: string): Promise<InformePdf> {
        const respuesta = await this.llamar(`webhook/informe?t=${encodeURIComponent(codigo)}`, ESPERA_INFORME_MS, {
            method: "GET",
        });
        if (respuesta.status === 400 || respuesta.status === 404 || respuesta.status === 410) {
            throw new InformeAsistenteError(respuesta.status, MENSAJES_INFORME[respuesta.status]);
        }
        if (!respuesta.ok) {
            this.logger.warn(`n8n respondió ${respuesta.status} al pedir un informe.`);
            throw new AsistenteOcupadoError();
        }
        const contenido = Buffer.from(await respuesta.arrayBuffer());
        if (contenido.subarray(0, 5).toString("latin1") !== "%PDF-") {
            this.logger.warn("n8n devolvió un informe que no es PDF.");
            throw new AsistenteOcupadoError();
        }
        return { contenido };
    }

    private async llamar(ruta: string, esperaMs: number, init: RequestInit): Promise<Response> {
        if (!this.secreto) throw new AsistenteNoConfiguradoError();
        try {
            return await fetch(new URL(ruta, this.base), {
                ...init,
                headers: {
                    ...(init.headers as Record<string, string> | undefined),
                    [CABECERA_SECRETO_N8N]: this.secreto,
                },
                redirect: "error",
                signal: AbortSignal.timeout(esperaMs),
            });
        } catch (error) {
            // DOMException no siempre hereda de Error: se mira solo el nombre
            const nombre = (error as { name?: unknown } | null)?.name;
            const agotado = nombre === "TimeoutError" || nombre === "AbortError";
            this.logger.warn(agotado ? "n8n no respondió a tiempo." : "No se pudo conectar con n8n.");
            throw new AsistenteOcupadoError(agotado);
        }
    }
}
