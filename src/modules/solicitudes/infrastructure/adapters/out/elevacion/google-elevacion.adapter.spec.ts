import { Logger } from "@nestjs/common";
import { GoogleElevacionAdapter } from "./google-elevacion.adapter";

const CLAVE = "AIza-clave-secreta-de-prueba";

const respuestaOk = (elevation: number) =>
    ({ ok: true, status: 200, json: () => Promise.resolve({ status: "OK", results: [{ elevation }] }) }) as Response;

describe("GoogleElevacionAdapter", () => {
    let peticion: jest.Mock<Promise<Response>, [string, RequestInit?]>;
    let advertencias: jest.SpyInstance;

    beforeEach(() => {
        peticion = jest.fn<Promise<Response>, [string, RequestInit?]>(() => Promise.resolve(respuestaOk(1290.456)));
        advertencias = jest.spyOn(Logger.prototype, "warn").mockImplementation();
    });

    afterEach(() => jest.restoreAllMocks());

    const crear = () => new GoogleElevacionAdapter(CLAVE, peticion as unknown as typeof fetch);

    it("devuelve la elevación redondeada a dos decimales", async () => {
        await expect(crear().consultar(1.85, -76.05)).resolves.toBe(1290.46);
    });

    it("manda las coordenadas redondeadas a 4 decimales y un timeout", async () => {
        await crear().consultar(1.850049, -76.050051);

        const [url, opciones] = peticion.mock.calls[0];
        expect(url).toContain("locations=1.8500%2C-76.0501");
        expect(opciones?.signal).toBeInstanceOf(AbortSignal);
    });

    it("reutiliza la consulta de coordenadas que redondean igual", async () => {
        const adaptador = crear();

        await adaptador.consultar(1.85001, -76.05001);
        await adaptador.consultar(1.85004, -76.05004);

        expect(peticion).toHaveBeenCalledTimes(1);
    });

    it("no cachea los fallos: la siguiente consulta vuelve a intentar", async () => {
        peticion.mockRejectedValueOnce(new Error("red caída"));
        const adaptador = crear();

        await expect(adaptador.consultar(1.85, -76.05)).resolves.toBeNull();
        await expect(adaptador.consultar(1.85, -76.05)).resolves.toBe(1290.46);
    });

    it.each([
        ["la red falla", () => peticion.mockRejectedValue(new Error("fetch failed"))],
        ["se agota el tiempo", () => peticion.mockRejectedValue(new DOMException("timeout", "TimeoutError"))],
        ["Google responde HTTP 500", () => peticion.mockResolvedValue({ ok: false, status: 500 } as Response)],
        [
            "la clave es inválida",
            () =>
                peticion.mockResolvedValue({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({ status: "REQUEST_DENIED", results: [] }),
                } as Response),
        ],
        [
            "el cuerpo no es JSON",
            () =>
                peticion.mockResolvedValue({
                    ok: true,
                    status: 200,
                    json: () => Promise.reject(new SyntaxError("Unexpected token")),
                } as Response),
        ],
    ])("devuelve null sin lanzar cuando %s", async (_caso, preparar) => {
        preparar();

        await expect(crear().consultar(1.85, -76.05)).resolves.toBeNull();
    });

    it("no escribe la clave en ningún log aunque el error la traiga en su mensaje", async () => {
        peticion.mockRejectedValue(new Error(`GET https://maps.googleapis.com/...&key=${CLAVE} falló`));

        await crear().consultar(1.85, -76.05);

        expect(advertencias).toHaveBeenCalled();
        expect(JSON.stringify(advertencias.mock.calls)).not.toContain(CLAVE);
    });

    it("devuelve null con coordenadas no finitas sin llamar a Google", async () => {
        await expect(crear().consultar(Number.NaN, 0)).resolves.toBeNull();

        expect(peticion).not.toHaveBeenCalled();
    });
});
