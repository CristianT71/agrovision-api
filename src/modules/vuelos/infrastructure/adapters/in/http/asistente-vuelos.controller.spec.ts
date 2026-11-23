import {
    type CanActivate,
    type ExecutionContext,
    type INestApplication,
    UnauthorizedException,
    ValidationPipe,
} from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerModule } from "@nestjs/throttler";
import { Test } from "@nestjs/testing";
import { peticionSinSocket } from "./testing/peticion-sin-socket";
import { AsistenteVuelosController } from "./asistente-vuelos.controller";
import { JwtAuthGuard } from "../../../../../../common/guards/jwt-auth.guard";
import {
    esRutaPublica,
    THROTTLER_PUBLICO,
    THROTTLER_USUARIO,
    ThrottlerPorUsuarioGuard,
} from "../../../../../../common/guards/throttler-por-usuario.guard";
import { ASISTENTE_VUELOS } from "../../../../domain/ports/in/asistente-vuelos.port";
import { ASISTENTE_IA } from "../../../../domain/ports/out/asistente-ia.port";
import { VUELOS_REPOSITORY } from "../../../../domain/ports/out/vuelos.repository";
import { AsistenteVuelosService } from "../../../../application/use-cases/asistente-vuelos.service";
import { AsistenteOcupadoError, InformeAsistenteError } from "../../../../domain/errors/vuelos.error";

jest.mock("../../../../../../common/guards/jwt-auth.guard", () => ({ JwtAuthGuard: class {} }));
// @nestjs/jwt es ESM: el guard de límites solo necesita verifyAsync, que aquí siempre falla (cuenta por IP)
jest.mock("@nestjs/jwt", () => ({
    JwtService: class {
        verifyAsync = () => Promise.reject(new Error("sin firma"));
    },
}));
import { JwtService } from "@nestjs/jwt";

class SesionDePrueba implements CanActivate {
    canActivate(ctx: ExecutionContext) {
        const req = ctx.switchToHttp().getRequest<{ headers: Record<string, string>; user?: unknown }>();
        if (!req.headers["x-rol"]) throw new UnauthorizedException();
        req.user = { id: "actor", rol: req.headers["x-rol"] };
        return true;
    }
}
const id = "11111111-1111-4111-8111-111111111111";
const codigo = `1999999999-${"a".repeat(48)}`;
const mensaje = { sessionId: "sesion-1", chatInput: "¿Cómo está el vigor?" };

const repo = { obtener: jest.fn() };
const ia = { conversar: jest.fn(), descargarInforme: jest.fn() };

async function crearApp() {
    const modulo = await Test.createTestingModule({
        imports: [
            ThrottlerModule.forRoot({
                throttlers: [
                    { name: THROTTLER_PUBLICO, ttl: 60_000, limit: 10, skipIf: (c) => !esRutaPublica(c) },
                    { name: THROTTLER_USUARIO, ttl: 60_000, limit: 240, skipIf: (c) => esRutaPublica(c) },
                ],
            }),
        ],
        controllers: [AsistenteVuelosController],
        providers: [
            JwtService,
            { provide: APP_GUARD, useClass: ThrottlerPorUsuarioGuard },
            { provide: ASISTENTE_VUELOS, useClass: AsistenteVuelosService },
            { provide: VUELOS_REPOSITORY, useValue: repo },
            { provide: ASISTENTE_IA, useValue: ia },
        ],
    })
        .overrideGuard(JwtAuthGuard)
        .useClass(SesionDePrueba)
        .compile();
    const app = modulo.createNestApplication();
    app.setGlobalPrefix("api");
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    return app;
}

beforeEach(() => {
    jest.resetAllMocks();
    repo.obtener.mockResolvedValue({ id });
    ia.conversar.mockResolvedValue({ output: "Vigor alto" });
});

describe("Asistente de vuelos (chat e informe)", () => {
    let app: INestApplication;
    beforeAll(async () => {
        app = await crearApp();
    });
    afterAll(async () => {
        await app.close();
    });
    const http = () => peticionSinSocket(app);

    it.each([
        ["post", `/api/vuelos/${id}/chat`],
        ["get", `/api/vuelos/${id}/informe?t=${codigo}`],
    ] as const)("%s %s exige sesión (401) y admin (403) sin llamar a n8n", async (metodo, ruta) => {
        await http()[metodo](ruta).send(mensaje).expect(401);
        await http()[metodo](ruta).set("x-rol", "agronomo").send(mensaje).expect(403);
        expect(repo.obtener).not.toHaveBeenCalled();
        expect(ia.conversar).not.toHaveBeenCalled();
        expect(ia.descargarInforme).not.toHaveBeenCalled();
    });

    it("un vuelo que no existe responde 404 y no gasta saldo del modelo", async () => {
        repo.obtener.mockResolvedValue(null);
        await http().post(`/api/vuelos/${id}/chat`).set("x-rol", "admin").send(mensaje).expect(404);
        await http().get(`/api/vuelos/${id}/informe?t=${codigo}`).set("x-rol", "admin").expect(404);
        expect(ia.conversar).not.toHaveBeenCalled();
        expect(ia.descargarInforme).not.toHaveBeenCalled();
    });

    it("usa el vuelo de la ruta y devuelve la respuesta de n8n tal cual", async () => {
        const r = await http()
            .post(`/api/vuelos/${id}/chat`)
            .set("x-rol", "admin")
            .send({ ...mensaje, chatInput: "  hola  " })
            .expect(200);
        expect(r.body).toEqual({ output: "Vigor alto" });
        expect(ia.conversar).toHaveBeenCalledWith({ vueloId: id, sessionId: "sesion-1", chatInput: "hola" });
    });

    it("valida el cuerpo, el UUID y el código del informe antes de llamar a n8n", async () => {
        await http().post("/api/vuelos/no-uuid/chat").set("x-rol", "admin").send(mensaje).expect(400);
        await http()
            .post(`/api/vuelos/${id}/chat`)
            .set("x-rol", "admin")
            .send({ ...mensaje, sessionId: "x" })
            .expect(422);
        await http()
            .post(`/api/vuelos/${id}/chat`)
            .set("x-rol", "admin")
            .send({ ...mensaje, chatInput: "a".repeat(4001) })
            .expect(422);
        await http()
            .post(`/api/vuelos/${id}/chat`)
            .set("x-rol", "admin")
            .send({ ...mensaje, vueloId: "otro" })
            .expect(422);
        await http().get(`/api/vuelos/${id}/informe?t=../../etc/passwd`).set("x-rol", "admin").expect(422);
        expect(ia.conversar).not.toHaveBeenCalled();
        expect(ia.descargarInforme).not.toHaveBeenCalled();
    });

    it("n8n ocupado responde 503 y tiempo agotado 504, con mensaje claro", async () => {
        ia.conversar.mockRejectedValueOnce(new AsistenteOcupadoError());
        const ocupado = await http().post(`/api/vuelos/${id}/chat`).set("x-rol", "admin").send(mensaje).expect(503);
        expect(ocupado.body.mensaje).toMatch(/ocupado/);
        ia.conversar.mockRejectedValueOnce(new AsistenteOcupadoError(true));
        const agotado = await http().post(`/api/vuelos/${id}/chat`).set("x-rol", "admin").send(mensaje).expect(504);
        expect(agotado.body.mensaje).toMatch(/tardó demasiado/);
    });

    it("entrega el PDF como descarga privada y propaga el enlace vencido (410)", async () => {
        ia.descargarInforme.mockResolvedValueOnce({ contenido: Buffer.from("%PDF-1.7") });
        const r = await http().get(`/api/vuelos/${id}/informe?t=${codigo}.pdf`).set("x-rol", "admin").expect(200);
        expect(ia.descargarInforme).toHaveBeenCalledWith(codigo);
        expect(r.headers).toMatchObject({ "content-type": "application/pdf", "cache-control": "private, no-store" });
        expect(r.headers["content-disposition"]).toContain("attachment");
        expect(r.body).toBe("%PDF-1.7");
        ia.descargarInforme.mockRejectedValueOnce(
            new InformeAsistenteError(410, "El enlace venció. Pide un informe nuevo."),
        );
        await http().get(`/api/vuelos/${id}/informe?t=${codigo}`).set("x-rol", "admin").expect(410);
    });
});

describe("Límite del chat por cuenta", () => {
    let app: INestApplication;
    beforeAll(async () => {
        app = await crearApp();
    });
    afterAll(async () => {
        await app.close();
    });

    it("permite 10 mensajes por minuto y responde 429 al siguiente sin llamar a n8n", async () => {
        for (let i = 0; i < 10; i++) {
            await peticionSinSocket(app).post(`/api/vuelos/${id}/chat`).set("x-rol", "admin").send(mensaje).expect(200);
        }
        await peticionSinSocket(app).post(`/api/vuelos/${id}/chat`).set("x-rol", "admin").send(mensaje).expect(429);
        expect(ia.conversar).toHaveBeenCalledTimes(10);
    });
});
