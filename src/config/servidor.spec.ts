import { crearOpcionesCors, esRutaPublicaAbierta, leerOrigenesCors, leerSaltosProxy } from "./servidor";

describe("Configuración del servidor", () => {
    describe("leerOrigenesCors", () => {
        it("sin variable usa el panel local", () => {
            expect(leerOrigenesCors(undefined)).toEqual(["http://localhost:5173"]);
            expect(leerOrigenesCors("  ")).toEqual(["http://localhost:5173"]);
        });

        it("acepta varios orígenes separados por coma", () => {
            expect(leerOrigenesCors("http://localhost:5173, https://panel.ejemplo.com")).toEqual([
                "http://localhost:5173",
                "https://panel.ejemplo.com",
            ]);
        });

        it("quita la barra final: el navegador envía el origen sin ella", () => {
            expect(leerOrigenesCors("https://v2pws886-5173.usw3.devtunnels.ms/")).toEqual([
                "https://v2pws886-5173.usw3.devtunnels.ms",
            ]);
        });
    });

    describe("leerSaltosProxy", () => {
        it("sin variable no confía en ningún proxy", () => {
            expect(leerSaltosProxy(undefined)).toBe(0);
            expect(leerSaltosProxy("")).toBe(0);
        });

        it("lee la cantidad de proxies", () => {
            expect(leerSaltosProxy("1")).toBe(1);
        });

        it.each(["-1", "1.5", "abc", "99"])("rechaza %s", (valor) => {
            expect(() => leerSaltosProxy(valor)).toThrow("TRUST_PROXY");
        });
    });

    describe("esRutaPublicaAbierta", () => {
        it.each([
            "/api/public/v1/catalog",
            "/api/public/v1/catalog/",
            "/api/public/v1/catalog?tipo=plaga",
            "/api/public/v1/catalog/Enfermedad_Roya",
            "/api/public/v1/catalog/Enfermedad_Roya?x=1",
        ])("abre %s", (ruta) => {
            expect(esRutaPublicaAbierta(ruta)).toBe(true);
        });

        it.each([
            "/api/public/v1/models/current",
            "/api/public/v1/catalogo",
            "/api/plagas",
            "/api/solicitudes",
            "/api/auth/solicitar-otp",
            "/",
        ])("no abre %s", (ruta) => {
            expect(esRutaPublicaAbierta(ruta)).toBe(false);
        });
    });

    describe("crearOpcionesCors", () => {
        const opcionesPara = (url: string) => {
            let opciones: unknown;
            crearOpcionesCors(["https://panel.ejemplo.com"])({ url, headers: {} } as never, (_error, resultado) => {
                opciones = resultado;
            });
            return opciones;
        };

        it("deja el catálogo público abierto a cualquier origen, solo para lectura", () => {
            expect(opcionesPara("/api/public/v1/catalog")).toEqual({
                origin: "*",
                methods: ["GET", "HEAD", "OPTIONS"],
                maxAge: 86_400,
            });
        });

        it("el resto de la API conserva la lista de orígenes", () => {
            expect(opcionesPara("/api/solicitudes")).toEqual({ origin: ["https://panel.ejemplo.com"] });
            expect(opcionesPara("/api/public/v1/models/current")).toEqual({ origin: ["https://panel.ejemplo.com"] });
        });
    });
});
