import { BadRequestException, ValidationPipe, type ArgumentsHost } from "@nestjs/common";
import { GUARDS_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { ROLES_KEY } from "../../../../../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../../../../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../../../../../common/guards/roles.guard";
import { ReglasZonaController } from "./reglas-zona.controller";
import { ReglasZonaExceptionFilter } from "./reglas-zona-exception.filter";
import { EditarReglaZonaDto } from "./dto/reglas-zona.dto";
import { FILAS_EJEMPLO } from "../../../../domain/testing/filas-ejemplo";
import {
    ReglaInmutableError,
    ReglaInvalidaError,
    ReglaNoAprobadaError,
    ReglaNoEncontradaError,
    SinPermisoAprobarError,
} from "../../../../domain/errors/reglas-zona.error";

jest.mock("@nestjs/passport", () => ({ AuthGuard: () => class {} }));

const handler = (nombre: keyof ReglasZonaController) =>
    Object.getOwnPropertyDescriptor(ReglasZonaController.prototype, nombre)!.value as object;

describe("ReglasZonaController (metadatos)", () => {
    it("exige JWT y roles admin/agronomo en todo el controlador", () => {
        expect(Reflect.getMetadata(PATH_METADATA, ReglasZonaController)).toBe("reglas-zona");
        expect(Reflect.getMetadata(GUARDS_METADATA, ReglasZonaController)).toEqual([JwtAuthGuard, RolesGuard]);
        expect(Reflect.getMetadata(ROLES_KEY, ReglasZonaController)).toEqual(["admin", "agronomo"]);
    });

    it("aprobar es solo para agronomo", () => {
        expect(Reflect.getMetadata(ROLES_KEY, handler("aprobar"))).toEqual(["agronomo"]);
        expect(Reflect.getMetadata(ROLES_KEY, handler("activar"))).toBeUndefined();
    });
});

describe("ReglasZonaExceptionFilter", () => {
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    const host = {
        switchToHttp: () => ({
            getRequest: () => ({ url: "/api/reglas-zona/x", method: "POST" }),
            getResponse: () => ({ status }),
        }),
    } as unknown as ArgumentsHost;

    it.each([
        [new ReglaNoEncontradaError(), 404, "REGLA_NO_ENCONTRADA"],
        [new ReglaInvalidaError(["Fila 1: x"]), 422, "REGLA_INVALIDA"],
        [new ReglaInmutableError(), 409, "REGLA_INMUTABLE"],
        [new SinPermisoAprobarError(), 403, "SIN_PERMISO_APROBAR"],
        [new ReglaNoAprobadaError(), 409, "REGLA_NO_APROBADA"],
    ])("traduce %s a %i con su código", (error, esperado, codigo) => {
        json.mockClear();
        new ReglasZonaExceptionFilter().catch(error, host);
        expect(status).toHaveBeenCalledWith(esperado);
        expect(json).toHaveBeenCalledWith(expect.objectContaining({ statusCode: esperado, codigo }));
    });

    it("incluye el detalle de validación", () => {
        json.mockClear();
        new ReglasZonaExceptionFilter().catch(new ReglaInvalidaError(["Fila 2: a", "Fila 3: b"]), host);
        expect(json).toHaveBeenCalledWith(expect.objectContaining({ detalles: ["Fila 2: a", "Fila 3: b"] }));
    });
});

describe("EditarReglaZonaDto (ValidationPipe global)", () => {
    const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
    const meta = { type: "body" as const, metatype: EditarReglaZonaDto };

    it("rechaza filas: null con 400 en vez de llegar al dominio", async () => {
        await expect(pipe.transform({ filas: null }, meta)).rejects.toBeInstanceOf(BadRequestException);
        await expect(pipe.transform({ filas: "x" }, meta)).rejects.toBeInstanceOf(BadRequestException);
    });

    it("permite omitir filas o enviar un arreglo", async () => {
        await expect(pipe.transform({ notas: "n" }, meta)).resolves.toEqual({ notas: "n" });
        await expect(pipe.transform({ filas: FILAS_EJEMPLO }, meta)).resolves.toMatchObject({ filas: FILAS_EJEMPLO });
    });
});
