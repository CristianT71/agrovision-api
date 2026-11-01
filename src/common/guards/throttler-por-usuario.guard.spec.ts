import { Controller, Get, type INestApplication } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { Throttle, ThrottlerModule } from "@nestjs/throttler";
import { Test } from "@nestjs/testing";
import request from "supertest";
import type { App } from "supertest/types";
import {
    esRutaPublica,
    THROTTLER_PUBLICO,
    THROTTLER_USUARIO,
    ThrottlerPorUsuarioGuard,
} from "./throttler-por-usuario.guard";

// @nestjs/jwt se publica como ESM y Jest no lo carga: se reemplaza por una verificación simulada.
// Un token "firmado:<id>" es válido y devuelve ese id; cualquier otro falla como una firma falsa.
jest.mock("@nestjs/jwt", () => ({
    JwtService: class {
        verifyAsync(token: string): Promise<{ sub: string }> {
            return token.startsWith("firmado:")
                ? Promise.resolve({ sub: token.slice(8) })
                : Promise.reject(new Error("firma inválida"));
        }
    },
}));

import { JwtService } from "@nestjs/jwt";

@Controller("prueba")
class PruebaController {
    @Get("publica")
    @Throttle({ publico: { limit: 2, ttl: 60_000 } })
    publica() {
        return "ok";
    }

    @Get("privada")
    @Throttle({ usuario: { limit: 2, ttl: 60_000 } })
    privada() {
        return "ok";
    }
}

describe("ThrottlerPorUsuarioGuard", () => {
    let app: INestApplication;

    beforeAll(async () => {
        const modulo = await Test.createTestingModule({
            imports: [
                ThrottlerModule.forRoot({
                    throttlers: [
                        { name: THROTTLER_PUBLICO, ttl: 60_000, limit: 10, skipIf: (c) => !esRutaPublica(c) },
                        { name: THROTTLER_USUARIO, ttl: 60_000, limit: 10, skipIf: (c) => esRutaPublica(c) },
                    ],
                }),
            ],
            controllers: [PruebaController],
            providers: [JwtService, { provide: APP_GUARD, useClass: ThrottlerPorUsuarioGuard }],
        }).compile();

        app = modulo.createNestApplication();
        await app.init();
    });

    afterAll(async () => {
        await app.close();
    });

    const servidor = () => app.getHttpServer() as App;
    const token = (sub: string) => `Bearer firmado:${sub}`;

    it("limita por IP las rutas públicas", async () => {
        await request(servidor()).get("/prueba/publica").expect(200);
        await request(servidor()).get("/prueba/publica").expect(200);
        await request(servidor()).get("/prueba/publica").expect(429);
    });

    it("cuenta por cuenta, no por IP, las rutas con sesión", async () => {
        const a = token("usuario-a");
        await request(servidor()).get("/prueba/privada").set("Authorization", a).expect(200);
        await request(servidor()).get("/prueba/privada").set("Authorization", a).expect(200);
        await request(servidor()).get("/prueba/privada").set("Authorization", a).expect(429);

        // Otra cuenta desde la misma IP tiene su propio cupo
        await request(servidor()).get("/prueba/privada").set("Authorization", token("usuario-b")).expect(200);
    });

    it("un token falso no abre cupos nuevos: cuenta por IP", async () => {
        const falso = (n: number) => `Bearer inventado-${n}`;
        await request(servidor()).get("/prueba/privada").set("Authorization", falso(1)).expect(200);
        await request(servidor()).get("/prueba/privada").set("Authorization", falso(2)).expect(200);
        await request(servidor()).get("/prueba/privada").set("Authorization", falso(3)).expect(429);
    });
});
