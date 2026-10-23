import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { normalizarTelefono } from "./telefono";
import { TelefonoInternacional } from "../validators/telefono-internacional";

class Cuerpo {
    @TelefonoInternacional()
    telefono: string;
}

const validar = async (telefono: unknown) => {
    const cuerpo = plainToInstance(Cuerpo, { telefono });
    return { errores: await validate(cuerpo), telefono: cuerpo.telefono };
};

describe("Teléfonos (RF-01.3)", () => {
    describe("normalizarTelefono", () => {
        it.each([
            ["+573001234567", "+573001234567"],
            ["573001234567", "+573001234567"],
            ["+57 300 123 4567", "+573001234567"],
            ["+57-300-123-4567", "+573001234567"],
            ["+1 (555) 123-4567", "+15551234567"],
            ["+52 55 1234 5678", "+525512345678"],
            ["+51 987 654 321", "+51987654321"],
            ["+593 99 123 4567", "+593991234567"],
        ])("%s se guarda como %s", (entrada, esperado) => {
            expect(normalizarTelefono(entrada)).toBe(esperado);
        });

        it.each([
            "3001234567", // sin prefijo del país: podría ser de cualquier lugar
            "+573001234", // incompleto
            "+5730012345678", // de más
            "+34600123456", // España: prefijo no admitido
            "+57300abc4567",
            "",
            "+",
        ])("rechaza %p", (entrada) => {
            expect(normalizarTelefono(entrada)).toBeNull();
        });

        it("el mismo número escrito de dos formas da la misma cuenta", () => {
            expect(normalizarTelefono("573001234567")).toBe(normalizarTelefono("+57 300 123 4567"));
        });
    });

    describe("@TelefonoInternacional", () => {
        it("normaliza antes de validar: el servicio recibe E.164", async () => {
            const { errores, telefono } = await validar("57 300 123 4567");

            expect(errores).toHaveLength(0);
            expect(telefono).toBe("+573001234567");
        });

        it("rechaza un prefijo no admitido con el mensaje de RF-01.3", async () => {
            const { errores } = await validar("+34600123456");

            expect(Object.values(errores[0].constraints ?? {}).join(" ")).toContain("+57, +1, +52, +51, +593");
        });

        it.each([undefined, null, 3001234567, ""])("rechaza %p", async (valor) => {
            expect((await validar(valor)).errores.length).toBeGreaterThan(0);
        });
    });
});
