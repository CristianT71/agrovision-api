import type { NextFunction, Request, Response } from "express";
import {
    OPCIONES_FOTOS_CATALOGO,
    soloFotosCatalogo,
} from "../../../../../../common/almacenamiento/fotos-catalogo-publicas";

describe("Fotos públicas del catálogo (unidad, sin sockets)", () => {
    const uuid = "11111111-1111-4111-8111-111111111111";
    let next: jest.Mock;
    let res: Response;
    let setHeader: jest.Mock;
    let status: jest.Mock;
    let end: jest.Mock;
    beforeEach(() => {
        next = jest.fn();
        setHeader = jest.fn();
        status = jest.fn().mockReturnThis();
        end = jest.fn();
        res = { setHeader, status, end } as unknown as Response;
    });
    const invocar = (path: string, method = "GET") =>
        soloFotosCatalogo({ path, method } as Request, res, next as NextFunction);

    it.each(["GET", "HEAD"])("permite %s anónimo a una foto sin redirección ni índice de directorio", (metodo) => {
        invocar(`/${uuid}.png`, metodo);
        expect(next).toHaveBeenCalledTimes(1);
        expect(status).not.toHaveBeenCalled();
        expect(OPCIONES_FOTOS_CATALOGO).toMatchObject({
            prefix: "/archivos/plagas/",
            index: false,
            redirect: false,
            dotfiles: "deny",
        });
    });

    it.each([
        ["jpg", "image/jpeg"],
        ["png", "image/png"],
        ["webp", "image/webp"],
    ])("sirve %s con el tipo correcto y nosniff", (extension, tipo) => {
        invocar(`/${uuid}.${extension}`);
        OPCIONES_FOTOS_CATALOGO.setHeaders!(res, `/uploads/publico/plagas/${uuid}.${extension}`, {});
        expect(setHeader).toHaveBeenCalledWith("Content-Type", tipo);
        expect(setHeader).toHaveBeenCalledWith("X-Content-Type-Options", "nosniff");
    });

    it.each([
        "/",
        "/.env",
        "/%2e%2e%2f%2e%2e%2fprivado%2fsecreto.png",
        "/../../privado/secreto.png",
        `/${uuid}.pdf`,
        "/no-existe.png",
        `/${uuid}.png/otra`,
        `/${uuid}.png%00`,
    ])("no lista directorios ni permite otros archivos o traversal: %s", (ruta) => {
        invocar(ruta);
        expect(status).toHaveBeenCalledWith(404);
        expect(end).toHaveBeenCalled();
        expect(next).not.toHaveBeenCalled();
    });

    it("es solo de lectura", () => {
        invocar(`/${uuid}.png`, "POST");
        expect(status).toHaveBeenCalledWith(404);
        expect(next).not.toHaveBeenCalled();
    });
});
