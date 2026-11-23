import { ConflictException, NotFoundException } from "@nestjs/common";
import { PoliticaDatosService } from "./politica-datos.service";
import { VERSION_POLITICA_DATOS } from "../../domain/politica-datos";
import type {
    AceptacionPoliticaDatos,
    IPoliticaDatosRepository,
} from "../../domain/ports/out/politica-datos.repository";

describe("PoliticaDatosService", () => {
    let almacenado: AceptacionPoliticaDatos | null;
    let registrar: jest.Mock;
    let revocar: jest.Mock;
    let servicio: PoliticaDatosService;

    beforeEach(() => {
        almacenado = { version: null, fecha: null };
        registrar = jest.fn((_id: string, version: string, fecha: Date) => {
            almacenado = { version, fecha };
            return Promise.resolve();
        });
        revocar = jest.fn(() => {
            almacenado = { version: null, fecha: null };
            return Promise.resolve();
        });
        const repositorio: IPoliticaDatosRepository = {
            obtener: () => Promise.resolve(almacenado),
            registrar,
            revocar,
        };
        servicio = new PoliticaDatosService(repositorio);
    });

    it("sin aceptación previa, la política no está aceptada", async () => {
        const estado = await servicio.consultar("u-1");

        expect(estado).toMatchObject({
            versionVigente: VERSION_POLITICA_DATOS,
            versionAceptada: null,
            aceptada: false,
        });
    });

    it("registra la versión vigente con su fecha", async () => {
        const estado = await servicio.aceptar("u-1", VERSION_POLITICA_DATOS);

        expect(registrar).toHaveBeenCalledWith("u-1", VERSION_POLITICA_DATOS, expect.any(Date));
        expect(estado.aceptada).toBe(true);
        expect(estado.fechaAceptacion).toBeInstanceOf(Date);
    });

    it("rechaza aceptar una versión que no es la vigente", async () => {
        await expect(servicio.aceptar("u-1", "0.1")).rejects.toBeInstanceOf(ConflictException);
        expect(registrar).not.toHaveBeenCalled();
    });

    it("aceptar otra vez la misma versión conserva la fecha original", async () => {
        const fechaOriginal = new Date("2026-01-01T00:00:00Z");
        almacenado = { version: VERSION_POLITICA_DATOS, fecha: fechaOriginal };

        const estado = await servicio.aceptar("u-1", VERSION_POLITICA_DATOS);

        expect(registrar).not.toHaveBeenCalled();
        expect(estado.fechaAceptacion).toEqual(fechaOriginal);
    });

    it("una versión anterior aceptada ya no cuenta como vigente", async () => {
        almacenado = { version: "0.9", fecha: new Date() };

        const estado = await servicio.consultar("u-1");

        expect(estado.aceptada).toBe(false);
    });

    it("al revocar, vuelve a quedar sin aceptar", async () => {
        almacenado = { version: VERSION_POLITICA_DATOS, fecha: new Date() };

        const estado = await servicio.revocar("u-1");

        expect(revocar).toHaveBeenCalledWith("u-1");
        expect(estado).toMatchObject({ versionAceptada: null, aceptada: false });
    });

    it("falla si el usuario no existe", async () => {
        almacenado = null;

        await expect(servicio.consultar("u-x")).rejects.toBeInstanceOf(NotFoundException);
    });
});
