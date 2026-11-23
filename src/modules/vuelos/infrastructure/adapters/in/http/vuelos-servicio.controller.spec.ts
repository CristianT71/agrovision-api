jest.mock("@nestjs/config", () => ({ ConfigService: class {} }));

import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { VuelosServicioController } from "./vuelos-servicio.controller";
import { peticionSinSocket } from "./testing/peticion-sin-socket";
import { GESTION_VUELOS } from "../../../../domain/ports/in/vuelos.port";
import { CORRELACION_APP } from "../../../../domain/ports/in/correlacion-app.port";
import { VueloNoEncontradoError } from "../../../../domain/errors/vuelos.error";

describe("GET servicio/vuelos/:id/correlacion-app", () => {
    let app: INestApplication;
    const llave = "llave-exclusiva-de-prueba-de-32-caracteres";
    const correlacion = { ejecutar: jest.fn() };
    const id = "11111111-1111-4111-8111-111111111111";
    const ruta = `/api/servicio/vuelos/${id}/correlacion-app`;
    beforeAll(async () => {
        const modulo = await Test.createTestingModule({
            controllers: [VuelosServicioController],
            providers: [
                { provide: GESTION_VUELOS, useValue: {} },
                { provide: CORRELACION_APP, useValue: correlacion },
                { provide: ConfigService, useValue: { get: () => llave } },
            ],
        }).compile();
        app = modulo.createNestApplication();
        app.setGlobalPrefix("api");
        app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
        await app.init();
    });
    beforeEach(() => {
        jest.resetAllMocks();
        correlacion.ejecutar.mockResolvedValue({ registros: [], truncado: false });
    });
    afterAll(async () => {
        await app.close();
    });
    it("exige la llave de servicio real", async () => {
        await peticionSinSocket(app).get(ruta).expect(401);
        await peticionSinSocket(app).get(ruta).set("X-Api-Key", "incorrecta").expect(401);
        expect(correlacion.ejecutar).not.toHaveBeenCalled();
    });
    it.each([
        ["", 300],
        ["?radioM=0", 0],
        ["?radioM=2000", 2000],
    ])("acepta %s", async (query, radio) => {
        await peticionSinSocket(app)
            .get(ruta + query)
            .set("X-Api-Key", llave)
            .expect(200);
        expect(correlacion.ejecutar).toHaveBeenCalledWith(id, radio);
    });
    it.each(["-1", "2001", "1.5", "abc", "Infinity", "", "300&radioM=400"])("rechaza radio %s", async (radio) => {
        await peticionSinSocket(app).get(`${ruta}?radioM=${radio}`).set("X-Api-Key", llave).expect(422);
        expect(correlacion.ejecutar).not.toHaveBeenCalled();
    });
    it("valida UUID y mantiene 404 para vuelo inexistente", async () => {
        await peticionSinSocket(app).get(ruta.replace(id, "invalido")).set("X-Api-Key", llave).expect(400);
        expect(correlacion.ejecutar).not.toHaveBeenCalled();
        correlacion.ejecutar.mockRejectedValue(new VueloNoEncontradoError());
        await peticionSinSocket(app).get(ruta).set("X-Api-Key", llave).expect(404);
    });
});
