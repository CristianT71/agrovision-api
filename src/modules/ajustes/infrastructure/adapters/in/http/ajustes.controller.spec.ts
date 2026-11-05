import { ExecutionContext, INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import type { App } from "supertest/types";
import { AjustesController } from "./ajustes.controller";
import { AjustesService } from "../../../../application/use-cases/ajustes.service";
import { AJUSTES_REPOSITORY, type IAjustesRepository } from "../../../../domain/ports/out/ajustes.repository";
import { JwtAuthGuard } from "../../../../../../common/guards/jwt-auth.guard";

// Usuario que "inicia sesión" en cada petición: se elige con la cabecera x-rol
function simularSesion(contexto: ExecutionContext): boolean {
    const peticion = contexto.switchToHttp().getRequest<{ headers: Record<string, string>; user?: unknown }>();
    peticion.user = { id: "u-1", telefono: "3000000000", rol: peticion.headers["x-rol"], sesionId: "s-1" };
    return true;
}

// @nestjs/passport se publica como ESM y Jest no lo carga: el guard de JWT se reemplaza aquí por la sesión simulada
jest.mock("@nestjs/passport", () => ({ AuthGuard: () => class {} }));

describe("AjustesController (HTTP)", () => {
    let app: INestApplication;

    beforeEach(async () => {
        let personales: Record<string, unknown> = {};
        let sistema: Record<string, unknown> = {};
        const repositorio: IAjustesRepository = {
            obtenerPersonales: () => Promise.resolve(personales),
            guardarPersonales: (_id, ajustes) => Promise.resolve(void (personales = ajustes)),
            obtenerSistema: () => Promise.resolve(sistema),
            guardarSistema: (ajustes) => Promise.resolve(void (sistema = ajustes)),
        };
        const modulo = await Test.createTestingModule({
            controllers: [AjustesController],
            providers: [AjustesService, { provide: AJUSTES_REPOSITORY, useValue: repositorio }],
        })
            .overrideGuard(JwtAuthGuard)
            .useValue({ canActivate: simularSesion })
            .compile();
        app = modulo.createNestApplication();
        app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
        await app.init();
    });

    afterEach(async () => {
        await app.close();
    });

    const http = () => request(app.getHttpServer() as App);

    it("el agrónomo guarda y lee sus preferencias", async () => {
        await http().patch("/ajustes/mios").set("x-rol", "agronomo").send({ pushNavegador: false }).expect(200);
        const respuesta = await http().get("/ajustes/mios").set("x-rol", "agronomo").expect(200);
        expect(respuesta.body as unknown).toEqual({
            idioma: "Español (Colombia)",
            zonaHoraria: "Bogotá (UTC−5)",
            pushNavegador: false,
            nuevasSolicitudes: true,
        });
    });

    it("rechaza valores fuera de las opciones y claves desconocidas", async () => {
        await http().patch("/ajustes/mios").set("x-rol", "admin").send({ idioma: "Klingon" }).expect(400);
        await http().patch("/ajustes/mios").set("x-rol", "admin").send({ inventado: true }).expect(400);
    });

    it("el agrónomo no puede cambiar eventos del administrador", async () => {
        await http().patch("/ajustes/mios").set("x-rol", "agronomo").send({ fallosOTA: false }).expect(400);
    });

    it("administrador y agrónomo consultan el tiempo de inactividad del panel", async () => {
        await http().patch("/ajustes/sistema").set("x-rol", "admin").send({ expiracionSesion: "4 horas" }).expect(200);

        for (const rol of ["admin", "agronomo"]) {
            const respuesta = await http().get("/ajustes/sesion").set("x-rol", rol).expect(200);
            expect(respuesta.body as unknown).toEqual({ minutosInactividad: 240 });
        }
        await http().get("/ajustes/sesion").set("x-rol", "productor").expect(403);
    });

    it("los ajustes del sistema son solo del administrador", async () => {
        await http().get("/ajustes/sistema").set("x-rol", "agronomo").expect(403);
        await http()
            .patch("/ajustes/sistema")
            .set("x-rol", "agronomo")
            .send({ asignacionAutomatica: true })
            .expect(403);

        const respuesta = await http()
            .patch("/ajustes/sistema")
            .set("x-rol", "admin")
            .send({ asignacionAutomatica: true, cargaMaximaAgronomo: "15 casos" })
            .expect(200);
        expect(respuesta.body as unknown).toMatchObject({
            asignacionAutomatica: true,
            cargaMaximaAgronomo: "15 casos",
        });
        await http().patch("/ajustes/sistema").set("x-rol", "admin").send({ expiracionSesion: "1 año" }).expect(400);
    });
});
