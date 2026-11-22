import { leerCodigosFijos } from "./codigos-fijos";

describe("leerCodigosFijos", () => {
    const validos = { admin: "111111", agronomo: "222222", productor: "333333" };

    it("devuelve el código de cada rol", () => {
        const codigos = leerCodigosFijos(validos);

        expect(codigos.para("admin")).toBe("111111");
        expect(codigos.para("agronomo")).toBe("222222");
        expect(codigos.para("productor")).toBe("333333");
    });

    it("ignora espacios alrededor del código", () => {
        expect(leerCodigosFijos({ ...validos, admin: " 123456 " }).para("admin")).toBe("123456");
    });

    it.each([
        ["admin", "OTP_FIJO_ADMIN"],
        ["agronomo", "OTP_FIJO_AGRONOMO"],
        ["productor", "OTP_FIJO_PRODUCTOR"],
    ] as const)("falla al arrancar si falta el código de %s", (rol, variable) => {
        expect(() => leerCodigosFijos({ ...validos, [rol]: undefined })).toThrow(variable);
    });

    it.each(["12345", "1234567", "12345a", ""])("rechaza un código que no tiene 6 dígitos: '%s'", (malo) => {
        expect(() => leerCodigosFijos({ ...validos, productor: malo })).toThrow("6 dígitos");
    });
});
