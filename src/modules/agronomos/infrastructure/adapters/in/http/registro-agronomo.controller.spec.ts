import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import type { App } from "supertest/types";

// El caso de uso real arrastra dependencias de persistencia: aquí solo interesa el límite multipart
jest.mock("../../../../application/use-cases/registrar-agronomo.service", () => ({
    RegistrarAgronomoService: class {
        ejecutar = jest.fn().mockResolvedValue({ ok: true });
    },
}));

import { RegistrarAgronomoService } from "../../../../application/use-cases/registrar-agronomo.service";
import { RegistroAgronomoController } from "./registro-agronomo.controller";

describe("POST /agronomos/registro: límites multipart", () => {
    let app: INestApplication;

    beforeAll(async () => {
        const modulo = await Test.createTestingModule({
            controllers: [RegistroAgronomoController],
            providers: [RegistrarAgronomoService],
        }).compile();

        app = modulo.createNestApplication();
        await app.init();
    });

    afterAll(async () => {
        await app.close();
    });

    const servidor = () => app.getHttpServer() as App;

    it("acepta un formulario con los campos esperados", async () => {
        await request(servidor())
            .post("/agronomos/registro")
            .field("nombre", "Ana Pérez")
            .field("correo", "ana@example.com")
            .expect(201);
    });

    it("rechaza un formulario con demasiados campos antes de acumularlos", async () => {
        let peticion = request(servidor()).post("/agronomos/registro");
        for (let i = 0; i < 40; i++) peticion = peticion.field(`campo${i}`, "x");

        await peticion.expect(400);
    });

    it("rechaza un campo de texto demasiado grande", async () => {
        await request(servidor())
            .post("/agronomos/registro")
            .field("nombre", "x".repeat(64 * 1024))
            .expect((res) => expect([400, 413]).toContain(res.status));
    });
});
