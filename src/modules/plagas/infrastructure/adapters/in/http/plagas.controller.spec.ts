import { type ArgumentsHost, type ExecutionContext, Logger, ParseUUIDPipe, RequestMethod } from "@nestjs/common";
import {
    GUARDS_METADATA,
    HTTP_CODE_METADATA,
    METHOD_METADATA,
    PATH_METADATA,
    ROUTE_ARGS_METADATA,
} from "@nestjs/common/constants";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "../../../../../../common/decorators/roles.decorator";
import { HttpExceptionFilter } from "../../../../../../common/filters/http-exception.filter";
import { JwtAuthGuard } from "../../../../../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../../../../../common/guards/roles.guard";
import type { IAlmacenamientoArchivos } from "../../../../../../common/almacenamiento/almacenamiento.port";
import { EliminarPlagaService } from "../../../../application/use-cases/eliminar-plaga.service";
import { ObtenerPlagaService } from "../../../../application/use-cases/obtener-plaga.service";
import type { ListarPlagasService } from "../../../../application/use-cases/listar-plagas.service";
import type { CrearPlagaService } from "../../../../application/use-cases/crear-plaga.service";
import type { ActualizarPlagaService } from "../../../../application/use-cases/actualizar-plaga.service";
import type { AvalarPlagaService } from "../../../../application/use-cases/avalar-plaga.service";
import type { ActualizarProtocoloQuimicoService } from "../../../../application/use-cases/actualizar-protocolo-quimico.service";
import type { SubirFotoPlagaService } from "../../../../application/use-cases/subir-foto-plaga.service";
import { Plaga } from "../../../../domain/entities/plaga.entity";
import type { IPlagaRepository } from "../../../../domain/ports/out/plaga.repository";
import { PlagasController } from "./plagas.controller";

jest.mock("uuid", () => ({ v4: () => crypto.randomUUID() }));
// Aislar la autenticación Passport (ESM); se verifica su guard en los metadatos de la ruta.
jest.mock("../../../../../../common/guards/jwt-auth.guard", () => ({ JwtAuthGuard: class {} }));

const ID = "11111111-1111-4111-8111-111111111111";

describe("DELETE /api/plagas/:id (unidad, sin sockets)", () => {
    let controller: PlagasController;
    let repo: jest.Mocked<IPlagaRepository>;
    let ficha: Plaga | null;
    let eliminarPublico: jest.Mock;
    const handler = PlagasController.prototype.eliminar;
    const contexto = (rol?: string) =>
        ({
            getHandler: () => handler,
            getClass: () => PlagasController,
            switchToHttp: () => ({ getRequest: () => ({ user: rol ? { id: "usuario", rol } : undefined }) }),
        }) as unknown as ExecutionContext;

    beforeEach(() => {
        jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
        ficha = Plaga.crear({
            id: ID,
            nombreComun: "Ficha nueva",
            tipo: "plaga",
            descripcion: "Descripción",
            sintomas: "Síntomas",
            organosAfectados: ["hoja"],
            medidasContencion: "Manejo",
        });
        repo = {
            findById: jest.fn<Promise<Plaga | null>, [string]>(async () => ficha),
            findAll: jest.fn(),
            guardar: jest.fn(),
            existeNombreCientifico: jest.fn(),
            eliminar: jest.fn().mockResolvedValue(true),
            fotoEnUso: jest.fn().mockResolvedValue(false),
        };
        eliminarPublico = jest.fn();
        const obtener = new ObtenerPlagaService(repo);
        controller = new PlagasController(
            {} as ListarPlagasService,
            obtener,
            {} as CrearPlagaService,
            {} as ActualizarPlagaService,
            {} as AvalarPlagaService,
            {} as ActualizarProtocoloQuimicoService,
            {} as SubirFotoPlagaService,
            new EliminarPlagaService(repo, { eliminarPublico } as unknown as IAlmacenamientoArchivos, obtener),
        );
    });
    afterEach(() => jest.restoreAllMocks());

    const traducirError = (error: unknown) => {
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        new HttpExceptionFilter().catch(error, {
            switchToHttp: () => ({
                getResponse: () => res,
                getRequest: () => ({ method: "DELETE", url: `/api/plagas/${ID}` }),
            }),
        } as unknown as ArgumentsHost);
        return res;
    };

    it("declara DELETE protegido por JWT y rol agrónomo; devuelve 204 sin cuerpo al borrar", async () => {
        expect(Reflect.getMetadata(PATH_METADATA, PlagasController)).toBe("plagas");
        expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(":id");
        expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.DELETE);
        expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler)).toBe(204);
        expect(Reflect.getMetadata(GUARDS_METADATA, PlagasController)).toEqual([JwtAuthGuard, RolesGuard]);
        expect(new Reflector().getAllAndOverride(ROLES_KEY, [handler, PlagasController])).toEqual(["agronomo"]);
        expect(new RolesGuard(new Reflector()).canActivate(contexto("agronomo"))).toBe(true);
        await expect(controller.eliminar(ID)).resolves.toBeUndefined();
        expect(repo.eliminar).toHaveBeenCalledWith(ID);
    });

    it("traduce una ficha protegida a 409 y no elimina ficha ni foto", async () => {
        ficha = new Plaga(
            ID,
            "Roya renombrada",
            null,
            "enfermedad",
            "Descripción",
            "Síntomas",
            "cafe",
            ["hoja"],
            [],
            "Manejo",
            null,
            null,
            [],
            [],
            "Enfermedad_Roya",
        );
        const error: unknown = await controller.eliminar(ID).catch((e: unknown) => e);
        const res = traducirError(error);
        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ mensaje: expect.stringContaining("ficha protegida") }),
        );
        expect(repo.eliminar).not.toHaveBeenCalled();
        expect(eliminarPublico).not.toHaveBeenCalled();
    });

    it("devuelve 404 si no existe la ficha", async () => {
        ficha = null;
        const error: unknown = await controller.eliminar(ID).catch((e: unknown) => e);
        expect(traducirError(error).status).toHaveBeenCalledWith(404);
        expect(repo.eliminar).not.toHaveBeenCalled();
    });

    it.each(["admin", "caficultor", "piloto"])("el guard rechaza el rol %s con 403 antes de borrar", (rol) => {
        let error: unknown;
        try {
            new RolesGuard(new Reflector()).canActivate(contexto(rol));
        } catch (e) {
            error = e;
        }
        expect(traducirError(error).status).toHaveBeenCalledWith(403);
        expect(repo.eliminar).not.toHaveBeenCalled();
    });

    it("el pipe del parámetro rechaza id no UUID con 400 antes de consultar", async () => {
        const parametros = Reflect.getMetadata(ROUTE_ARGS_METADATA, PlagasController, "eliminar") as Record<
            string,
            { data: string; pipes: (typeof ParseUUIDPipe)[] }
        >;
        const parametro = Object.values(parametros).find((p) => p.data === "id")!;
        expect(parametro.pipes).toEqual([ParseUUIDPipe]);
        const pipe = new parametro.pipes[0]();
        const error: unknown = await pipe
            .transform("no-es-uuid", { type: "param", data: "id" })
            .catch((e: unknown) => e);
        expect(traducirError(error).status).toHaveBeenCalledWith(400);
        expect(await pipe.transform(ID, { type: "param", data: "id" })).toBe(ID);
        expect(repo.findById).not.toHaveBeenCalled();
        expect(repo.eliminar).not.toHaveBeenCalled();
    });
});
