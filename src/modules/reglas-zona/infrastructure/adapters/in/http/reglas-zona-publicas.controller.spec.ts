import { BadRequestException, ValidationPipe, type ExecutionContext } from "@nestjs/common";
import { GUARDS_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { THROTTLER_LIMIT } from "@nestjs/throttler/dist/throttler.constants";
import type { Response } from "express";
import { esRutaPublica } from "../../../../../../common/guards/throttler-por-usuario.guard";
import { ReglasZonaPublicasController } from "./reglas-zona-publicas.controller";
import { ReglasZonaPublicasService } from "../../../../application/use-cases/reglas-zona-publicas.service";
import { ConsultaPublicaReglasZonaDto } from "./dto/reglas-zona.dto";
import { ReglaZona } from "../../../../domain/entities/regla-zona";
import { FILAS_EJEMPLO } from "../../../../domain/testing/filas-ejemplo";
import type { IReglasZonaRepository } from "../../../../domain/ports/out/reglas-zona.repository";

jest.mock("@nestjs/jwt", () => ({ JwtService: class {} }));

const reglaActiva = () => {
    const r = ReglaZona.crearBorrador({
        id: "44444444-4444-4444-8444-444444444444",
        tipoEnfermedad: "roya",
        version: 5,
        notas: "privadas",
        filas: FILAS_EJEMPLO,
        creadaPor: "usuario-interno",
        ahora: new Date(),
    });
    r.aprobar({ nombre: "Ana Pérez", tarjetaProfesional: "TP-123" }, "agro", { calibrada: false }, new Date());
    r.activar(new Date());
    return r;
};

describe("GET /api/public/v1/zone-rules (unidad, sin sockets)", () => {
    const obtenerActiva = jest.fn();
    const controller = new ReglasZonaPublicasController(
        new ReglasZonaPublicasService({ obtenerActiva } as unknown as IReglasZonaRepository),
    );
    let setHeader: jest.Mock, status: jest.Mock, res: Response;

    beforeEach(() => {
        obtenerActiva.mockReset().mockResolvedValue(reglaActiva());
        setHeader = jest.fn();
        status = jest.fn();
        res = { setHeader, status } as unknown as Response;
    });

    it("es pública: sin guards de JWT/roles y con throttler público", () => {
        const clase = ReglasZonaPublicasController;
        const handler = Object.getOwnPropertyDescriptor(clase.prototype, "obtener")!
            .value as typeof clase.prototype.obtener;
        expect(Reflect.getMetadata(PATH_METADATA, clase)).toBe("public/v1/zone-rules");
        expect(Reflect.getMetadata(GUARDS_METADATA, clase)).toBeUndefined();
        expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toBeUndefined();
        expect(esRutaPublica({ getHandler: () => handler, getClass: () => clase } as unknown as ExecutionContext)).toBe(
            true,
        );
        expect(Reflect.getMetadata(THROTTLER_LIMIT + "publico", handler)).toBe(60);
    });

    it("200 con ETag y solo tipoEnfermedad, version, calibrada y filas", async () => {
        const cuerpo = await controller.obtener({ tipo: "roya" }, undefined, res);
        expect(cuerpo).toEqual({ tipoEnfermedad: "roya", version: 5, calibrada: false, filas: FILAS_EJEMPLO });
        const texto = JSON.stringify(cuerpo);
        for (const privado of ["44444444", "usuario-interno", "Ana Pérez", "TP-123", "privadas", "agro"])
            expect(texto).not.toContain(privado);
        expect(setHeader).toHaveBeenCalledWith("ETag", expect.stringMatching(/^"[0-9a-f]{64}"$/));
        expect(status).not.toHaveBeenCalled();
        expect(obtenerActiva).toHaveBeenCalledWith("roya");
    });

    it("el ETag es estable para el mismo contenido y cambia con la versión", async () => {
        await controller.obtener({ tipo: "roya" }, undefined, res);
        await controller.obtener({ tipo: "roya" }, undefined, res);
        const [a, b] = setHeader.mock.calls.filter((c) => c[0] === "ETag").map((c: [string, string]) => c[1]);
        expect(a).toBe(b);
        const otra = ReglaZona.reconstruir({ ...reglaActiva().instantanea(), version: 6 });
        obtenerActiva.mockResolvedValue(otra);
        await controller.obtener({ tipo: "roya" }, undefined, res);
        expect(setHeader.mock.calls.filter((c) => c[0] === "ETag").pop()![1]).not.toBe(a);
    });

    it("304 sin cuerpo si If-None-Match coincide (lista, débil o *)", async () => {
        await controller.obtener({ tipo: "roya" }, undefined, res);
        const etag = setHeader.mock.calls.find((c) => c[0] === "ETag")![1] as string;
        for (const cabecera of [etag, `"otro", ${etag}`, `W/${etag}`, "*"]) {
            status.mockClear();
            expect(await controller.obtener({ tipo: "roya" }, cabecera, res)).toBeUndefined();
            expect(status).toHaveBeenCalledWith(304);
        }
        status.mockClear();
        expect(await controller.obtener({ tipo: "roya" }, '"distinto"', res)).toBeDefined();
        expect(status).not.toHaveBeenCalled();
    });

    it("204 si no hay regla activa para el tipo", async () => {
        obtenerActiva.mockResolvedValue(null);
        expect(await controller.obtener({ tipo: "mancha" }, undefined, res)).toBeUndefined();
        expect(status).toHaveBeenCalledWith(204);
        expect(setHeader).not.toHaveBeenCalledWith("ETag", expect.anything());
    });

    it("400 si falta tipo (ValidationPipe global)", async () => {
        const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
        const meta = { type: "query" as const, metatype: ConsultaPublicaReglasZonaDto };
        await expect(pipe.transform({}, meta)).rejects.toBeInstanceOf(BadRequestException);
        await expect(pipe.transform({ tipo: "ROYA!" }, meta)).rejects.toBeInstanceOf(BadRequestException);
        await expect(pipe.transform({ tipo: "roya" }, meta)).resolves.toEqual({ tipo: "roya" });
    });
});
