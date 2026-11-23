import { BadRequestException, type ExecutionContext, ValidationPipe } from "@nestjs/common";
import { GUARDS_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { THROTTLER_LIMIT, THROTTLER_TTL } from "@nestjs/throttler/dist/throttler.constants";
import type { Response } from "express";
import { esRutaPublica } from "../../../../../../common/guards/throttler-por-usuario.guard";
import { SincronizarCatalogoService } from "../../../../application/use-cases/sincronizar-catalogo.service";
import type { ICatalogoRepository } from "../../../../domain/ports/out/catalogo.repository";
import { CatalogoPublicoController } from "./catalogo-publico.controller";
import { CatalogoSyncQueryDto } from "./dto/catalogo-sync.dto";

jest.mock("@nestjs/jwt", () => ({ JwtService: class {} }));

describe("GET /api/public/v1/pests/sync (unidad, sin sockets)", () => {
    let controller: CatalogoPublicoController;
    let leerDelta: jest.Mock;
    let res: Response;
    let setHeader: jest.Mock;
    let status: jest.Mock;
    beforeEach(() => {
        leerDelta = jest.fn().mockResolvedValue({ fichas: [], deletedIds: ["Plaga_Minador"], serverTime: 5000 });
        const repo: ICatalogoRepository = { leerDelta };
        controller = new CatalogoPublicoController(new SincronizarCatalogoService(repo, { urlPublica: () => null }));
        setHeader = jest.fn();
        status = jest.fn();
        res = { setHeader, status } as unknown as Response;
    });

    it("declara la ruta pública sin guards de JWT ni roles y un límite propio", () => {
        const clase = CatalogoPublicoController;
        const handler = Object.getOwnPropertyDescriptor(clase.prototype, "sync")!.value as typeof clase.prototype.sync;
        expect(Reflect.getMetadata(PATH_METADATA, clase)).toBe("public/v1/pests");
        expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe("sync");
        expect(Reflect.getMetadata(GUARDS_METADATA, clase)).toBeUndefined();
        expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toBeUndefined();
        expect(esRutaPublica({ getHandler: () => handler, getClass: () => clase } as unknown as ExecutionContext)).toBe(
            true,
        );
        expect(Reflect.getMetadata(THROTTLER_LIMIT + "publico", handler)).toBe(60);
        expect(Reflect.getMetadata(THROTTLER_TTL + "publico", handler)).toBe(60_000);
    });

    it("primer sync devuelve contrato y cabecera ETag sin sesión", async () => {
        const delta = await controller.sync({}, undefined, res);
        const { etag, ...contenido } = delta!;
        expect(contenido).toEqual({
            upserted: [],
            deletedIds: ["Plaga_Minador"],
            serverTime: 5000,
        });
        expect(setHeader).toHaveBeenCalledWith("ETag", etag);
        expect(etag).toMatch(/^"[0-9a-f]{64}"$/);
        expect(status).not.toHaveBeenCalled();
        expect(leerDelta).toHaveBeenCalledWith(undefined);
    });

    it("acepta since como texto y devuelve las bajas del delta", async () => {
        const delta = await controller.sync({ since: "2000" }, undefined, res);
        expect(leerDelta).toHaveBeenCalledWith(2000);
        expect(delta!.deletedIds).toEqual(["Plaga_Minador"]);
    });

    it("ETag coincidente devuelve 304 sin cuerpo aunque el reloj haya avanzado", async () => {
        const inicial = await controller.sync({}, undefined, res);
        leerDelta.mockResolvedValue({ fichas: [], deletedIds: ["Plaga_Minador"], serverTime: 6000 });
        for (const tag of [inicial!.etag, `"otra", W/${inicial!.etag}`, "*"]) {
            expect(await controller.sync({}, tag, res)).toBeUndefined();
            expect(status).toHaveBeenLastCalledWith(304);
            expect(setHeader).toHaveBeenCalledWith("ETag", inicial!.etag);
        }
        expect(await controller.sync({}, '"distinta"', res)).toBeDefined();
    });

    it.each(["-1", "1.2", "1e3", "no-fecha", "", "99999999999999", ["1", "2"]])(
        "rechaza since inválido %p",
        async (since) => {
            const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
            await expect(
                pipe.transform({ since }, { type: "query", metatype: CatalogoSyncQueryDto }),
            ).rejects.toBeInstanceOf(BadRequestException);
            expect(leerDelta).not.toHaveBeenCalled();
        },
    );
});
