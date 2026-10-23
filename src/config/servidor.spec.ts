import { leerOrigenesCors, leerSaltosProxy } from "./servidor";

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
});
