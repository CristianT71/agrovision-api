import { AjustesPoliticaSesionAdapter } from "./ajustes-politica-sesion.adapter";
import type { AjustesService } from "../../../../../ajustes/application/use-cases/ajustes.service";

describe("AjustesPoliticaSesionAdapter", () => {
    let expiracion: string;
    let obtenerSistema: jest.Mock<Promise<{ expiracionSesion: string }>, []>;
    let adaptador: AjustesPoliticaSesionAdapter;

    beforeEach(() => {
        jest.useFakeTimers({ now: new Date("2026-11-04T10:00:00Z") });
        expiracion = "1 hora";
        obtenerSistema = jest.fn(() => Promise.resolve({ expiracionSesion: expiracion }));
        adaptador = new AjustesPoliticaSesionAdapter({ obtenerSistema } as unknown as AjustesService);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it("traduce el ajuste a minutos", async () => {
        expect(await adaptador.minutosInactividadPanel()).toBe(60);
    });

    it("no lee la base en cada petición: recuerda el valor unos segundos", async () => {
        await adaptador.minutosInactividadPanel();
        await adaptador.minutosInactividadPanel();

        expect(obtenerSistema).toHaveBeenCalledTimes(1);
    });

    it("pasado ese tiempo toma el cambio del administrador", async () => {
        await adaptador.minutosInactividadPanel();
        expiracion = "15 minutos";
        jest.setSystemTime(new Date("2026-11-04T10:01:00Z"));

        expect(await adaptador.minutosInactividadPanel()).toBe(15);
    });
});
