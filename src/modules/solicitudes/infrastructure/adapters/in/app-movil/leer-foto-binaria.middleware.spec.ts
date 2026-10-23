import { ForbiddenException } from "@nestjs/common";
import type { Request, Response } from "express";
import { crearLectorFotoBinaria } from "./leer-foto-binaria.middleware";

// Petición mínima: si el middleware intentara leer el cuerpo, tocaría estos métodos de la corriente
function peticion(url: string, cabeceras: Record<string, string> = {}) {
    const lecturas: string[] = [];
    const req = {
        originalUrl: url,
        headers: cabeceras,
        on: () => lecturas.push("on"),
        once: () => lecturas.push("once"),
        pipe: () => lecturas.push("pipe"),
        resume: () => lecturas.push("resume"),
        read: () => lecturas.push("read"),
    } as unknown as Request;

    return { req, lecturas };
}

describe("Middleware de subida de fotos", () => {
    const res = {} as Response;

    it("con un token inválido responde 403 sin leer el cuerpo", () => {
        const { req, lecturas } = peticion("/api/v1/uploads/token-falso", {
            "content-type": "image/jpeg",
            "content-length": "10485760",
        });
        const siguiente = jest.fn();

        crearLectorFotoBinaria(() => false)(req, res, siguiente);

        expect(siguiente).toHaveBeenCalledTimes(1);
        expect(siguiente.mock.calls[0][0]).toBeInstanceOf(ForbiddenException);
        expect(lecturas).toHaveLength(0);
    });

    it("pasa al token que le llega por la ruta, sin la query", () => {
        const { req } = peticion("/api/v1/uploads/abc.def?x=1");
        const verificar = jest.fn(() => false);

        crearLectorFotoBinaria(verificar)(req, res, jest.fn());

        expect(verificar).toHaveBeenCalledWith("abc.def");
    });

    it("un token con codificación rota se rechaza en vez de tumbar la petición", () => {
        const { req } = peticion("/api/v1/uploads/%E0%A4%A");
        const siguiente = jest.fn();

        crearLectorFotoBinaria(() => false)(req, res, siguiente);

        expect(siguiente.mock.calls[0][0]).toBeInstanceOf(ForbiddenException);
    });

    it("con un token válido sigue adelante", () => {
        const { req } = peticion("/api/v1/uploads/token-bueno");
        const siguiente = jest.fn();

        crearLectorFotoBinaria(() => true)(req, res, siguiente);

        // Sin cuerpo declarado no hay nada que leer: continúa sin error
        expect(siguiente).toHaveBeenCalledWith();
    });
});
