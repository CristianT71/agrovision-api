import {
    type CanActivate,
    type ExecutionContext,
    type INestApplication,
    UnauthorizedException,
    ValidationPipe,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { peticionSinSocket } from "./testing/peticion-sin-socket";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { VuelosController } from "./vuelos.controller";
import { MediosVuelosController } from "./medios-vuelos.controller";
import { JwtAuthGuard } from "../../../../../../common/guards/jwt-auth.guard";
import { GESTION_VUELOS } from "../../../../domain/ports/in/vuelos.port";
import { LEER_MEDIO_VUELO } from "../../../../domain/ports/in/medios.port";
import { ALMACENAMIENTO_VUELOS } from "../../../../domain/ports/out/almacenamiento-vuelos.port";
import { LocalVuelosAdapter } from "../../out/storage/local-vuelos.adapter";
import { VueloExistenteGuard } from "./guards/vuelo-existente.guard";
import { SubidaVueloInterceptor } from "./subida-vuelo.interceptor";
import { TokenMedioError } from "../../../../domain/errors/vuelos.error";

jest.mock("../../../../../../common/guards/jwt-auth.guard", () => ({ JwtAuthGuard: class {} }));
class SesionDePrueba implements CanActivate {
    canActivate(ctx: ExecutionContext) {
        const req = ctx.switchToHttp().getRequest<{ headers: Record<string, string>; user?: unknown }>();
        if (!req.headers["x-rol"]) throw new UnauthorizedException();
        req.user = { id: "actor", rol: req.headers["x-rol"] };
        return true;
    }
}
const id = "11111111-1111-4111-8111-111111111111",
    a = "22222222-2222-4222-8222-222222222222";
describe("Rutas de vuelos y multipart real", () => {
    let app: INestApplication, raiz: string;
    const previo = { uploads: process.env.UPLOADS_DIR, max: process.env.VUELOS_MAX_ARCHIVO_MB };
    const gestion = {
        crear: jest.fn(),
        listar: jest.fn(),
        obtener: jest.fn(),
        actualizar: jest.fn(),
        eliminar: jest.fn(),
        exigirVuelo: jest.fn(),
        subir: jest.fn(),
        listarArchivos: jest.fn(),
        obtenerArchivo: jest.fn(),
        enlace: jest.fn(),
        traza: jest.fn(),
    };
    const leer = { ejecutar: jest.fn() };
    beforeAll(async () => {
        raiz = await mkdtemp(join(tmpdir(), "vuelos-http-"));
        process.env.UPLOADS_DIR = raiz;
        const modulo = await Test.createTestingModule({
            controllers: [MediosVuelosController, VuelosController],
            providers: [
                { provide: GESTION_VUELOS, useValue: gestion },
                { provide: LEER_MEDIO_VUELO, useValue: leer },
                { provide: ALMACENAMIENTO_VUELOS, useClass: LocalVuelosAdapter },
                VueloExistenteGuard,
                SubidaVueloInterceptor,
            ],
        })
            .overrideGuard(JwtAuthGuard)
            .useClass(SesionDePrueba)
            .compile();
        app = modulo.createNestApplication();
        app.setGlobalPrefix("api");
        app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
        await app.init();
    });
    beforeEach(() => {
        jest.resetAllMocks();
        gestion.subir.mockResolvedValue({ archivo: { id: a }, duplicado: false });
        process.env.VUELOS_MAX_ARCHIVO_MB = "1";
    });
    afterAll(async () => {
        await app.close();
        await rm(raiz, { recursive: true, force: true });
        for (const [k, v] of Object.entries({ UPLOADS_DIR: previo.uploads, VUELOS_MAX_ARCHIVO_MB: previo.max })) {
            if (v === undefined) delete process.env[k];
            else process.env[k] = v;
        }
    });
    const http = () => peticionSinSocket(app);
    const rutas: ["get" | "post" | "patch" | "delete", string][] = [
        ["post", "/api/vuelos"],
        ["get", "/api/vuelos"],
        ["get", `/api/vuelos/${id}`],
        ["patch", `/api/vuelos/${id}`],
        ["delete", `/api/vuelos/${id}`],
        ["post", `/api/vuelos/${id}/archivos`],
        ["get", `/api/vuelos/${id}/archivos`],
        ["get", `/api/vuelos/${id}/archivos/${a}`],
        ["post", `/api/vuelos/${id}/archivos/${a}/enlace`],
        ["get", `/api/vuelos/${id}/traza`],
    ];
    it.each(rutas)("%s %s exige sesión (401) y admin (403)", async (metodo, ruta) => {
        await http()[metodo](ruta).expect(401);
        await http()[metodo](ruta).set("x-rol", "agronomo").expect(403);
        expect(gestion.exigirVuelo).not.toHaveBeenCalled();
    });
    it("valida UUID y DTOs antes de invocar el caso de uso", async () => {
        await http().get("/api/vuelos/invalido").set("x-rol", "admin").expect(400);
        await http().post("/api/vuelos").set("x-rol", "admin").send({ nombre: "" }).expect(422);
        await http().patch(`/api/vuelos/${id}`).set("x-rol", "admin").send({ nombre: null }).expect(422);
        await http().get("/api/vuelos?limite=101").set("x-rol", "admin").expect(422);
        await http().get(`/api/vuelos/${id}/archivos?limite=201`).set("x-rol", "admin").expect(422);
        expect(gestion.crear).not.toHaveBeenCalled();
    });
    it("responde 201 o 200 cuando la subida fue idempotente", async () => {
        await http()
            .post(`/api/vuelos/${id}/archivos`)
            .set("x-rol", "admin")
            .attach("archivo", Buffer.from([0xff, 0xd8, 1]), "a.jpg")
            .expect(201);
        gestion.subir.mockResolvedValue({ archivo: { id: a }, duplicado: true });
        const r = await http()
            .post(`/api/vuelos/${id}/archivos`)
            .set("x-rol", "admin")
            .attach("archivo", Buffer.from([0xff, 0xd8, 1]), "a.jpg")
            .expect(200);
        expect(r.body).toEqual({ id: a });
    });
    it("rechaza extensión (415), firma (422) y limpia los parciales", async () => {
        const antes = await readdir(join(raiz, "vuelos", id)).catch(() => []);
        await http()
            .post(`/api/vuelos/${id}/archivos`)
            .set("x-rol", "admin")
            .attach("archivo", Buffer.from("texto"), "a.exe")
            .expect(415);
        await http()
            .post(`/api/vuelos/${id}/archivos`)
            .set("x-rol", "admin")
            .attach("archivo", Buffer.from("texto"), "a.jpg")
            .expect(422);
        expect(await readdir(join(raiz, "vuelos", id))).toEqual(antes);
        expect(gestion.subir).not.toHaveBeenCalled();
    });
    it("aplica VUELOS_MAX_ARCHIVO_MB pequeño y responde 413", async () => {
        process.env.VUELOS_MAX_ARCHIVO_MB = "0.000003";
        const antes = await readdir(join(raiz, "vuelos", id)).catch(() => []);
        await http()
            .post(`/api/vuelos/${id}/archivos`)
            .set("x-rol", "admin")
            .attach("archivo", Buffer.from([0xff, 0xd8, 1, 2, 3, 4, 5, 6]), "a.jpg")
            .expect(413);
        expect(await readdir(join(raiz, "vuelos", id))).toEqual(antes);
        expect(gestion.subir).not.toHaveBeenCalled();
    });
    it("medios usa solo la firma y admite Range con cabeceras privadas", async () => {
        leer.ejecutar.mockResolvedValue({
            flujo: Readable.from(["234"]),
            tamano: 10,
            inicio: 2,
            fin: 4,
            parcial: true,
            mime: "video/mp4",
            nombre: "a.mp4",
            inline: true,
        });
        const r = await http().get("/api/vuelos/medios/firmado").set("Range", "bytes=2-4").expect(206);
        expect(leer.ejecutar).toHaveBeenCalledWith("firmado", "bytes=2-4");
        expect(r.headers).toMatchObject({
            "content-range": "bytes 2-4/10",
            "cache-control": "private, no-store",
            "x-content-type-options": "nosniff",
        });
        expect(r.headers["content-disposition"]).toContain("inline;");
    });
    it.each([
        [false, 403],
        [true, 410],
    ])("token vencido=%s responde %s sin exponer el token", async (vencido, status) => {
        leer.ejecutar.mockRejectedValue(new TokenMedioError(vencido as boolean));
        const r = await http()
            .get("/api/vuelos/medios/token-secreto")
            .expect(status as number);
        expect(JSON.stringify(r.body)).not.toContain("token-secreto");
    });
});
