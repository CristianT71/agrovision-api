import { CanActivate, ExecutionContext, INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import type { Server } from "node:http";
import { SolicitudesController } from "./solicitudes.controller";
import { JwtAuthGuard } from "../../../../../../common/guards/jwt-auth.guard";
import { HttpExceptionFilter } from "../../../../../../common/filters/http-exception.filter";
import { ResolverSolicitudService } from "../../../../application/use-cases/resolver-solicitud.service";
import { ListarSolicitudesService } from "../../../../application/use-cases/listar-solicitudes.service";
import { ObtenerSolicitudPorIdService } from "../../../../application/use-cases/obtener-solicitud-por-id.service";
import { AsignarSolicitudService } from "../../../../application/use-cases/asignar-solicitud.service";
import { ListarFotosSolicitudService } from "../../../../application/use-cases/listar-fotos-solicitud.service";
import { DescargarFotoSolicitudService } from "../../../../application/use-cases/descargar-foto-solicitud.service";
import { AnexosResolucionService } from "../../../../application/use-cases/anexos-resolucion.service";
import { CasosSimilaresService } from "../../../../application/use-cases/casos-similares.service";
import { ContarSolicitudesService } from "../../../../application/use-cases/contar-solicitudes.service";
import { ResumirResolucionesService } from "../../../../application/use-cases/resumir-resoluciones.service";
import { ObtenerUbicacionSolicitudService } from "../../../../application/use-cases/obtener-ubicacion-solicitud.service";
import { ListarMapaSolicitudesService } from "../../../../application/use-cases/listar-mapa-solicitudes.service";

// El guard real arrastra @nestjs/passport (ESM), que Jest no carga: se reemplaza por una clase vacía y luego por la de prueba
jest.mock("../../../../../../common/guards/jwt-auth.guard", () => ({ JwtAuthGuard: class {} }));

const ID = "11111111-1111-4111-8111-111111111111";

// Autenticación de prueba: el rol llega en la cabecera x-rol
class JwtDePrueba implements CanActivate {
    canActivate(contexto: ExecutionContext): boolean {
        const req = contexto.switchToHttp().getRequest<{ headers: Record<string, string>; user?: unknown }>();
        req.user = { id: "u-1", telefono: "+57", rol: req.headers["x-rol"] ?? "admin", sesionId: "s" };
        return true;
    }
}

describe("Rutas de ubicación y mapa de solicitudes", () => {
    let app: INestApplication;
    const obtenerPorId = { ejecutar: jest.fn() };
    const ubicacion = {
        ejecutar: jest.fn(),
        ejecutarKml: jest.fn(() => Promise.resolve({ nombreArchivo: "sol-11111111.kml", kml: "<kml/>" })),
    };
    const mapa = {
        ejecutar: jest.fn(() => Promise.resolve({ puntos: [], truncado: false, limite: 500 })),
        ejecutarKml: jest.fn(() => Promise.resolve({ nombreArchivo: "mapa-solicitudes.kml", kml: "<kml/>" })),
    };

    beforeAll(async () => {
        const sinUso = [
            ResolverSolicitudService,
            ListarSolicitudesService,
            AsignarSolicitudService,
            ListarFotosSolicitudService,
            DescargarFotoSolicitudService,
            AnexosResolucionService,
            CasosSimilaresService,
            ContarSolicitudesService,
            ResumirResolucionesService,
        ].map((clase) => ({ provide: clase, useValue: {} }));

        const modulo = await Test.createTestingModule({
            controllers: [SolicitudesController],
            providers: [
                ...sinUso,
                { provide: ObtenerSolicitudPorIdService, useValue: obtenerPorId },
                { provide: ObtenerUbicacionSolicitudService, useValue: ubicacion },
                { provide: ListarMapaSolicitudesService, useValue: mapa },
            ],
        })
            .overrideGuard(JwtAuthGuard)
            .useClass(JwtDePrueba)
            .compile();

        app = modulo.createNestApplication();
        app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
        app.useGlobalFilters(new HttpExceptionFilter());
        await app.init();
    });

    afterAll(async () => {
        await app.close();
    });

    beforeEach(() => jest.clearAllMocks());

    const http = () => request(app.getHttpServer() as Server);

    it("GET /solicitudes/mapa no se confunde con :id", async () => {
        await http().get("/solicitudes/mapa").expect(200);

        expect(mapa.ejecutar).toHaveBeenCalledTimes(1);
        expect(obtenerPorId.ejecutar).not.toHaveBeenCalled();
    });

    it("GET /solicitudes/mapa.kml tampoco, y responde un adjunto KML", async () => {
        const respuesta = await http().get("/solicitudes/mapa.kml").expect(200);

        expect(obtenerPorId.ejecutar).not.toHaveBeenCalled();
        expect(respuesta.headers["content-type"]).toContain("application/vnd.google-earth.kml+xml");
        expect(respuesta.headers["content-disposition"]).toBe('attachment; filename="mapa-solicitudes.kml"');
    });

    it("el mapa es solo del administrador: el agrónomo recibe 403 sin llegar al caso de uso", async () => {
        await http().get("/solicitudes/mapa").set("x-rol", "agronomo").expect(403);
        await http().get("/solicitudes/mapa.kml").set("x-rol", "agronomo").expect(403);

        expect(mapa.ejecutar).not.toHaveBeenCalled();
        expect(mapa.ejecutarKml).not.toHaveBeenCalled();
    });

    it("el productor no entra a ninguna ruta del panel", async () => {
        await http().get("/solicitudes/mapa").set("x-rol", "productor").expect(403);
        await http().get(`/solicitudes/${ID}/ubicacion`).set("x-rol", "productor").expect(403);
    });

    it("valida los filtros del mapa", async () => {
        await http().get("/solicitudes/mapa?estado=Inventado").expect(400);
        await http().get("/solicitudes/mapa?desde=no-es-fecha").expect(400);
        await http().get("/solicitudes/mapa?agronomoId=123").expect(400);
        await http().get("/solicitudes/mapa?limite=9999").expect(400);

        expect(mapa.ejecutar).not.toHaveBeenCalled();
    });

    it("convierte los filtros válidos del mapa", async () => {
        await http().get("/solicitudes/mapa?estado=Enviada&cultivo=CAFE&desde=2026-05-01").expect(200);

        expect(mapa.ejecutar).toHaveBeenCalledWith(
            expect.objectContaining({ rol: "admin" }),
            expect.objectContaining({ estado: "Enviada", cultivo: "CAFE", desde: new Date("2026-05-01") }),
        );
    });

    it("GET /solicitudes/:id/ubicacion exige un UUID", async () => {
        await http().get("/solicitudes/no-es-uuid/ubicacion").expect(400);
        await http().get(`/solicitudes/${ID}/ubicacion`).expect(200);

        expect(ubicacion.ejecutar).toHaveBeenCalledWith(expect.objectContaining({ rol: "admin" }), ID);
    });

    it("GET /solicitudes/:id/ubicacion.kml responde KML como adjunto con nombre armado por el servidor", async () => {
        const respuesta = await http().get(`/solicitudes/${ID}/ubicacion.kml`).set("x-rol", "agronomo").expect(200);

        expect(respuesta.headers["content-type"]).toContain("application/vnd.google-earth.kml+xml");
        expect(respuesta.headers["content-disposition"]).toBe('attachment; filename="sol-11111111.kml"');
        expect(ubicacion.ejecutarKml).toHaveBeenCalledWith(expect.objectContaining({ rol: "agronomo" }), ID);
    });
});
