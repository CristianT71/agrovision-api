import { ConfigService } from "@nestjs/config";
import { CABECERA_SECRETO_N8N, ESPERA_CHAT_MS, N8nAsistenteAdapter } from "./n8n-asistente.adapter";
import {
    AsistenteNoConfiguradoError,
    AsistenteOcupadoError,
    InformeAsistenteError,
} from "../../../../domain/errors/vuelos.error";

// @nestjs/config es ESM y Jest no lo carga: basta un get sobre un objeto
jest.mock("@nestjs/config", () => ({
    ConfigService: class {
        constructor(private datos: Record<string, unknown>) {}
        get(clave: string) {
            return this.datos[clave];
        }
    },
}));

const SECRETO = "s".repeat(40);
const vueloId = "11111111-1111-4111-8111-111111111111";
const crear = (vars: Record<string, string | undefined> = {}) =>
    new N8nAsistenteAdapter(
        new ConfigService({ N8N_CHAT_SECRET: SECRETO, N8N_WEBHOOK_URL: "http://n8n.local:5678", ...vars }),
    );
const respuesta = (cuerpo: BodyInit | null, status = 200) => new Response(cuerpo, { status });

describe("N8nAsistenteAdapter", () => {
    let fetchMock: jest.SpyInstance;
    beforeEach(() => {
        fetchMock = jest.spyOn(globalThis, "fetch");
    });
    afterEach(() => jest.restoreAllMocks());

    it("reenvía el mensaje con la cabecera secreta y devuelve la respuesta de n8n tal cual", async () => {
        const timeout = jest.spyOn(AbortSignal, "timeout");
        fetchMock.mockResolvedValue(respuesta(JSON.stringify([{ output: "Hola" }])));
        await expect(crear().conversar({ vueloId, sessionId: "sesion-1", chatInput: "hola" })).resolves.toEqual([
            { output: "Hola" },
        ]);
        const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
        expect(url.href).toBe("http://n8n.local:5678/webhook/asistente");
        expect((init.headers as Record<string, string>)[CABECERA_SECRETO_N8N]).toBe(SECRETO);
        expect(JSON.parse(init.body as string)).toEqual({
            action: "sendMessage",
            sessionId: "sesion-1",
            chatInput: "hola",
            vueloId,
        });
        expect(init.redirect).toBe("error");
        expect(timeout).toHaveBeenCalledWith(ESPERA_CHAT_MS);
    });

    it("sin N8N_CHAT_SECRET no llama a n8n", async () => {
        await expect(
            crear({ N8N_CHAT_SECRET: undefined }).conversar({ vueloId, sessionId: "sesion-1", chatInput: "x" }),
        ).rejects.toBeInstanceOf(AsistenteNoConfiguradoError);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("rechaza al arrancar un secreto corto o igual a N8N_API_KEY", () => {
        expect(() => crear({ N8N_CHAT_SECRET: "corto" })).toThrow(/al menos 32/);
        expect(() => crear({ N8N_API_KEY: SECRETO })).toThrow(/distinta/);
        expect(() => crear({ N8N_WEBHOOK_URL: "ftp://x" })).toThrow(/http/);
    });

    it("traduce el tiempo agotado, la caída de red y los errores de n8n a 'ocupado'", async () => {
        const adaptador = crear();
        const msg = { vueloId, sessionId: "sesion-1", chatInput: "x" };
        fetchMock.mockRejectedValueOnce(new DOMException("tiempo", "TimeoutError"));
        await expect(adaptador.conversar(msg)).rejects.toMatchObject({ agotado: true });
        fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
        await expect(adaptador.conversar(msg)).rejects.toMatchObject({ agotado: false });
        fetchMock.mockResolvedValueOnce(respuesta("ocupado", 500));
        await expect(adaptador.conversar(msg)).rejects.toBeInstanceOf(AsistenteOcupadoError);
        fetchMock.mockResolvedValueOnce(respuesta("no", 403));
        await expect(adaptador.conversar(msg)).rejects.toBeInstanceOf(AsistenteOcupadoError);
        fetchMock.mockResolvedValueOnce(respuesta("<html>", 200));
        await expect(adaptador.conversar(msg)).rejects.toBeInstanceOf(AsistenteOcupadoError);
    });

    it("descarga el informe con el secreto y propaga 400/404/410 con mensajes propios", async () => {
        const adaptador = crear();
        const codigo = `1999999999-${"a".repeat(48)}`;
        fetchMock.mockResolvedValueOnce(respuesta(Buffer.from("%PDF-1.7 contenido")));
        const { contenido } = await adaptador.descargarInforme(codigo);
        expect(contenido.toString()).toBe("%PDF-1.7 contenido");
        const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
        expect(url.href).toBe(`http://n8n.local:5678/webhook/informe?t=${codigo}`);
        expect((init.headers as Record<string, string>)[CABECERA_SECRETO_N8N]).toBe(SECRETO);
        fetchMock.mockResolvedValueOnce(respuesta("<script>", 410));
        await expect(adaptador.descargarInforme(codigo)).rejects.toEqual(
            new InformeAsistenteError(410, "El enlace venció. Pide un informe nuevo."),
        );
        fetchMock.mockResolvedValueOnce(respuesta("no es pdf"));
        await expect(adaptador.descargarInforme(codigo)).rejects.toBeInstanceOf(AsistenteOcupadoError);
    });
});
