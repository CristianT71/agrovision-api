import { elegirCanalZavu, elegirProveedorSms, ocultarTelefono } from "./proveedor-sms";

describe("Proveedor de SMS", () => {
    describe("elegirProveedorSms", () => {
        it("por defecto usa la consola (desarrollo)", () => {
            expect(elegirProveedorSms({})).toBe("log");
        });

        it("usa Zavu cuando se pide y hay clave", () => {
            expect(elegirProveedorSms({ proveedor: "Zavu", zavuApiKey: "zv_123" })).toBe("zavu");
        });

        it("no arranca en producción con la consola: dejaría los códigos en los logs", () => {
            expect(() => elegirProveedorSms({ proveedor: "log", nodeEnv: "production" })).toThrow("production");
            expect(() => elegirProveedorSms({ nodeEnv: "production" })).toThrow("production");
        });

        it("en producción con Zavu sí arranca", () => {
            expect(elegirProveedorSms({ proveedor: "zavu", zavuApiKey: "zv_123", nodeEnv: "production" })).toBe("zavu");
        });

        it("Zavu sin clave falla al arrancar y no al primer login", () => {
            expect(() => elegirProveedorSms({ proveedor: "zavu" })).toThrow("ZAVU_API_KEY");
            expect(() => elegirProveedorSms({ proveedor: "zavu", zavuApiKey: "  " })).toThrow("ZAVU_API_KEY");
        });

        it("rechaza un proveedor desconocido", () => {
            expect(() => elegirProveedorSms({ proveedor: "twilio" })).toThrow("SMS_PROVIDER");
        });
    });

    describe("elegirCanalZavu", () => {
        it("por defecto deja elegir a Zavu", () => {
            expect(elegirCanalZavu(undefined)).toBe("auto");
        });

        it.each(["sms", "whatsapp", "auto"])("acepta %s", (canal) => {
            expect(elegirCanalZavu(canal)).toBe(canal);
        });

        it("rechaza un canal desconocido", () => {
            expect(() => elegirCanalZavu("telegram")).toThrow("ZAVU_CHANNEL");
        });
    });

    it("ocultarTelefono deja solo el prefijo y los últimos 4 dígitos", () => {
        expect(ocultarTelefono("+573001234567")).toBe("+57******4567");
        expect(ocultarTelefono("123")).toBe("***");
    });
});
