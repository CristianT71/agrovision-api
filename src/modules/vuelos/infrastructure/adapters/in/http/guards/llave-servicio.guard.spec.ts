import { UnauthorizedException, type ExecutionContext } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { LlaveServicioGuard } from "./llave-servicio.guard";

// @nestjs/config se publica como ESM y Jest no lo carga: solo se necesita el tipo
jest.mock("@nestjs/config", () => ({ ConfigService: class {} }));

const LLAVE = "a".repeat(48);

const configCon = (valor: string | undefined) => ({ get: () => valor }) as unknown as ConfigService;

const contextoCon = (cabeceras: Record<string, string | string[] | undefined>) =>
    ({ switchToHttp: () => ({ getRequest: () => ({ headers: cabeceras }) }) }) as unknown as ExecutionContext;

describe("LlaveServicioGuard", () => {
    it("deja pasar la llave correcta", () => {
        const guard = new LlaveServicioGuard(configCon(LLAVE));

        expect(guard.canActivate(contextoCon({ "x-api-key": LLAVE }))).toBe(true);
    });

    it("rechaza una llave distinta", () => {
        const guard = new LlaveServicioGuard(configCon(LLAVE));

        expect(() => guard.canActivate(contextoCon({ "x-api-key": "b".repeat(48) }))).toThrow(UnauthorizedException);
    });

    it("rechaza si no viene la cabecera o viene vacía", () => {
        const guard = new LlaveServicioGuard(configCon(LLAVE));

        expect(() => guard.canActivate(contextoCon({}))).toThrow(UnauthorizedException);
        expect(() => guard.canActivate(contextoCon({ "x-api-key": "" }))).toThrow(UnauthorizedException);
    });

    it("rechaza si la cabecera viene repetida (llega como arreglo)", () => {
        const guard = new LlaveServicioGuard(configCon(LLAVE));

        expect(() => guard.canActivate(contextoCon({ "x-api-key": [LLAVE, LLAVE] }))).toThrow(UnauthorizedException);
    });

    it("con la llave sin configurar la ruta queda cerrada, incluso para una llave vacía o cualquiera", () => {
        const guard = new LlaveServicioGuard(configCon(undefined));

        expect(() => guard.canActivate(contextoCon({ "x-api-key": "" }))).toThrow(UnauthorizedException);
        expect(() => guard.canActivate(contextoCon({ "x-api-key": LLAVE }))).toThrow(UnauthorizedException);
    });

    it("con una llave configurada demasiado corta la ruta queda cerrada", () => {
        const guard = new LlaveServicioGuard(configCon("corta"));

        expect(() => guard.canActivate(contextoCon({ "x-api-key": "corta" }))).toThrow(UnauthorizedException);
    });

    it("no revela el motivo: el mensaje es el mismo en todos los fallos", () => {
        const guard = new LlaveServicioGuard(configCon(LLAVE));
        const mensaje = (cabeceras: Record<string, string | undefined>) => {
            try {
                guard.canActivate(contextoCon(cabeceras));
            } catch (error) {
                return (error as UnauthorizedException).message;
            }
            return null;
        };

        expect(mensaje({})).toBe(mensaje({ "x-api-key": "b".repeat(48) }));
    });
});
