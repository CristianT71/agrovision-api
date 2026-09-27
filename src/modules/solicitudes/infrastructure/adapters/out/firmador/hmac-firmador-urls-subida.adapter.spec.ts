import type { ConfigService } from "@nestjs/config";
import { HmacFirmadorUrlsSubidaAdapter, VIGENCIA_URL_SUBIDA_MS } from "./hmac-firmador-urls-subida.adapter";

// @nestjs/config se publica como ESM y Jest no lo carga: solo se usa como tipo
jest.mock("@nestjs/config", () => ({ ConfigService: class {} }));

const configuracion = (valores: Record<string, string | undefined>) =>
    ({
        get: (clave: string) => valores[clave],
        getOrThrow: (clave: string) => {
            const valor = valores[clave];
            if (valor === undefined) throw new Error(`Falta ${clave}`);
            return valor;
        },
    }) as unknown as ConfigService;

const crearFirmador = (secreto = "secreto-de-prueba") =>
    new HmacFirmadorUrlsSubidaAdapter(
        configuracion({ UPLOAD_URL_SECRET: secreto, API_PUBLIC_URL: "http://10.0.2.2:3000/" }),
    );

// El token es el último segmento de la URL firmada
const tokenDe = (url: string) => url.split("/").pop() ?? "";

describe("HmacFirmadorUrlsSubidaAdapter", () => {
    afterEach(() => jest.useRealTimers());

    it("firma una URL de subida que luego verifica", () => {
        const firmador = crearFirmador();

        const url = firmador.firmar("foto-1");

        expect(url.startsWith("http://10.0.2.2:3000/api/v1/uploads/")).toBe(true);
        expect(firmador.verificar(tokenDe(url))).toBe("foto-1");
    });

    it("rechaza un token con la carga alterada", () => {
        const firmador = crearFirmador();
        const [, firma] = tokenDe(firmador.firmar("foto-1")).split(".");
        const cargaFalsa = Buffer.from(JSON.stringify({ fotoId: "foto-2", exp: Date.now() + 60_000 })).toString(
            "base64url",
        );

        expect(firmador.verificar(`${cargaFalsa}.${firma}`)).toBeNull();
    });

    it("rechaza un token con la firma alterada", () => {
        const firmador = crearFirmador();
        const [carga, firma] = tokenDe(firmador.firmar("foto-1")).split(".");
        // Se cambia el primer carácter: los últimos de un base64url pueden ser solo relleno
        const firmaAlterada = (firma.startsWith("A") ? "B" : "A") + firma.slice(1);

        expect(firmador.verificar(`${carga}.${firmaAlterada}`)).toBeNull();
    });

    it("rechaza un token firmado con otro secreto", () => {
        const token = tokenDe(crearFirmador("otro-secreto").firmar("foto-1"));

        expect(crearFirmador().verificar(token)).toBeNull();
    });

    it("rechaza un token vencido", () => {
        jest.useFakeTimers();
        const firmador = crearFirmador();
        const token = tokenDe(firmador.firmar("foto-1"));

        jest.advanceTimersByTime(VIGENCIA_URL_SUBIDA_MS + 1);

        expect(firmador.verificar(token)).toBeNull();
    });

    it.each(["", "sin-punto", "a.b.c", "!!!.???"])("rechaza el token mal formado %p", (token) => {
        expect(crearFirmador().verificar(token)).toBeNull();
    });

    it("no se puede crear sin UPLOAD_URL_SECRET", () => {
        expect(() => new HmacFirmadorUrlsSubidaAdapter(configuracion({}))).toThrow();
    });
});
