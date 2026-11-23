import { elegirProveedorCorreo } from "./proveedor-correo";

describe("elegirProveedorCorreo", () => {
    it("por defecto deja el correo en la consola", () => {
        expect(elegirProveedorCorreo({})).toBe("log");
    });

    it("smtp exige usuario y contraseña", () => {
        expect(() => elegirProveedorCorreo({ proveedor: "smtp" })).toThrow("MAIL_USER");
        expect(elegirProveedorCorreo({ proveedor: "SMTP", usuario: "a@gmail.com", clave: "x" })).toBe("smtp");
    });

    it("rechaza un proveedor desconocido", () => {
        expect(() => elegirProveedorCorreo({ proveedor: "sendgrid" })).toThrow("MAIL_PROVIDER");
    });
});
