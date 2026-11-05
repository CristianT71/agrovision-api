import { BadRequestException } from "@nestjs/common";
import { AjustesService } from "./ajustes.service";
import type { IAjustesRepository } from "../../domain/ports/out/ajustes.repository";
import type { AjustesPersonales, AjustesSistema } from "../../domain/ajustes";

describe("Ajustes - casos de uso", () => {
    let personales: Partial<AjustesPersonales>;
    let sistema: Partial<AjustesSistema>;
    let guardarPersonales: jest.Mock<Promise<void>, [string, Partial<AjustesPersonales>]>;
    let guardarSistema: jest.Mock<Promise<void>, [Partial<AjustesSistema>, string]>;
    let servicio: AjustesService;

    beforeEach(() => {
        personales = {};
        sistema = {};
        guardarPersonales = jest.fn((_id, ajustes) => {
            personales = ajustes;
            return Promise.resolve();
        });
        guardarSistema = jest.fn<Promise<void>, [Partial<AjustesSistema>, string]>((ajustes) => {
            sistema = ajustes;
            return Promise.resolve();
        });
        const repositorio: IAjustesRepository = {
            obtenerPersonales: () => Promise.resolve(personales),
            guardarPersonales,
            obtenerSistema: () => Promise.resolve(sistema),
            guardarSistema,
        };
        servicio = new AjustesService(repositorio);
    });

    it("sin nada guardado devuelve los valores por defecto del rol", async () => {
        const agronomo = await servicio.obtenerPersonales("u-1", "agronomo");
        expect(Object.keys(agronomo).sort()).toEqual(["idioma", "nuevasSolicitudes", "pushNavegador", "zonaHoraria"]);
        expect(agronomo.idioma).toBe("Español (Colombia)");

        const admin = await servicio.obtenerPersonales("u-2", "admin");
        expect(admin).toHaveProperty("fallosOTA", true);
        expect(admin).not.toHaveProperty("nuevasSolicitudes");
    });

    it("un PATCH cambia solo lo enviado y conserva lo guardado antes", async () => {
        await servicio.guardarPersonales("u-1", "agronomo", { pushNavegador: false });
        const resultado = await servicio.guardarPersonales("u-1", "agronomo", { idioma: "English (US)" });

        expect(resultado).toMatchObject({ pushNavegador: false, idioma: "English (US)", nuevasSolicitudes: true });
    });

    it("ignora las claves sin valor", async () => {
        await servicio.guardarPersonales("u-1", "admin", { idioma: undefined, despliegues: false });
        expect(guardarPersonales).toHaveBeenCalledWith("u-1", { despliegues: false });
    });

    it("rechaza ajustes que no son del rol", async () => {
        await expect(servicio.guardarPersonales("u-1", "agronomo", { fallosOTA: false })).rejects.toBeInstanceOf(
            BadRequestException,
        );
        expect(guardarPersonales).not.toHaveBeenCalled();
    });

    it("los ajustes del sistema se completan con los valores por defecto y registran quién los cambió", async () => {
        expect(await servicio.obtenerSistema()).toMatchObject({ cargaMaximaAgronomo: "10 casos" });

        const resultado = await servicio.guardarSistema({ asignacionAutomatica: true }, "admin-1");

        expect(resultado).toMatchObject({ asignacionAutomatica: true, expiracionSesion: "30 minutos" });
        expect(guardarSistema).toHaveBeenCalledWith({ asignacionAutomatica: true }, "admin-1");
    });
});
