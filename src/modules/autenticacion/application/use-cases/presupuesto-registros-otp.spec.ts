import { HttpStatus, type HttpException } from "@nestjs/common";
import { PresupuestoRegistrosOtp } from "./presupuesto-registros-otp";

const HORA = 60 * 60 * 1000;

describe("PresupuestoRegistrosOtp", () => {
    let ahora: number;
    const reloj = () => ahora;

    beforeEach(() => {
        ahora = 1_000_000;
    });

    it("responde 429 al pasar el tope global de registros por hora", () => {
        const presupuesto = new PresupuestoRegistrosOtp(2, 10, reloj);
        presupuesto.consumir("+573001111111");
        presupuesto.consumir("+573002222222");

        try {
            presupuesto.consumir("+573003333333");
            fail("debió lanzar");
        } catch (error) {
            expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
        }
    });

    it("da un cupo mucho menor a los números de fuera de Colombia", () => {
        const presupuesto = new PresupuestoRegistrosOtp(100, 1, reloj);
        presupuesto.consumir("+12025550101");

        expect(() => presupuesto.consumir("+12025550102")).toThrow();
        expect(() => presupuesto.consumir("+573001111111")).not.toThrow();
    });

    it("libera el cupo cuando pasa la hora", () => {
        const presupuesto = new PresupuestoRegistrosOtp(1, 1, reloj);
        presupuesto.consumir("+573001111111");
        expect(() => presupuesto.consumir("+573002222222")).toThrow();

        ahora += HORA;
        expect(() => presupuesto.consumir("+573002222222")).not.toThrow();
    });
});
