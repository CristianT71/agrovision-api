import { BadRequestException, NotFoundException } from "@nestjs/common";
import { RecibirCapturasService } from "./recibir-capturas.service";
import { ListarDeteccionesService } from "./listar-detecciones.service";
import { ObtenerDeteccionService } from "./obtener-deteccion.service";
import { ResumirDeteccionesService } from "./resumir-detecciones.service";
import { Deteccion } from "../../domain/entities/deteccion.entity";
import type { CapturaEntrada } from "../../domain/ports/in/recibir-capturas.port";
import type { DeteccionExistente, IDeteccionRepository } from "../../domain/ports/out/deteccion.repository";
import type { IConsultaModelos } from "../../domain/ports/out/consulta-modelos.port";
import type { DeteccionLeida, ILecturaDetecciones } from "../../domain/ports/out/lectura-detecciones.port";
import type { IProductorRepository } from "../../../productores/domain/ports/out/productor.repository";
import { Productor } from "../../../productores/domain/entities/productor.entity";

// uuid se publica como ESM y Jest no lo carga: se reemplaza por el generador nativo
jest.mock("uuid", () => ({ v4: () => crypto.randomUUID() }));

const PRODUCTOR = new Productor(
    "p-1",
    "u-prod",
    "Ana Pérez",
    "La Esperanza",
    "Bruselas",
    "Pitalito",
    "+573001234567",
    "validado",
    true,
    new Date(),
);

const captura = (idCliente: string, cambios: Partial<CapturaEntrada> = {}): CapturaEntrada => ({
    idCliente,
    capturadaEn: Date.now() - 60_000,
    modeloVersion: "1.2.0",
    clasePredicha: "Enfermedad_Roya",
    confianza: 0.91,
    puntajeOod: 0.4,
    resultadoCompuerta: "IDENTIFIED",
    embedding: null,
    correccionProductor: null,
    confirmadaProductor: false,
    cultivo: "CAFE",
    organo: "HOJA",
    ubicacion: null,
    ...cambios,
});

const leida = (cambios: Partial<DeteccionLeida> = {}): DeteccionLeida => ({
    deteccion: Deteccion.registrar({
        id: "d-1",
        idCliente: "c-1",
        productor: { id: "p-1", municipio: "Pitalito" },
        modelo: { id: "m-1", version: "1.2.0" },
        clasePredicha: "Enfermedad_Roya",
        confianza: 0.9,
        puntajeOod: 0.2,
        resultadoCompuerta: "IDENTIFIED",
        embedding: "AAAA",
        correccionProductor: null,
        confirmadaProductor: false,
        cultivo: "CAFE",
        organo: "HOJA",
        ubicacion: null,
        fecha: new Date(),
    }),
    productorNombre: "Ana Pérez",
    solicitudId: null,
    resultadoAgronomo: null,
    plagaAgronomo: null,
    ...cambios,
});

describe("Detecciones - casos de uso", () => {
    describe("RecibirCapturasService (RF-07.1)", () => {
        let repositorio: jest.Mocked<IDeteccionRepository>;
        let productores: jest.Mocked<IProductorRepository>;
        // Mocks sueltos para las aserciones: evita referenciar métodos del objeto (unbound-method)
        let insertarNuevas: jest.Mock<Promise<Set<string>>, [Deteccion[]]>;
        let findExistentes: jest.Mock<Promise<DeteccionExistente[]>, [string[]]>;
        let obtenerIdPorVersion: jest.Mock<Promise<string | null>, [string]>;

        beforeEach(() => {
            insertarNuevas = jest.fn((detecciones: Deteccion[]) =>
                Promise.resolve(new Set(detecciones.map((d) => d.idCliente))),
            );
            findExistentes = jest.fn<Promise<DeteccionExistente[]>, [string[]]>(() => Promise.resolve([]));
            obtenerIdPorVersion = jest.fn<Promise<string | null>, [string]>(() => Promise.resolve("m-1"));
            repositorio = { findExistentes, insertarNuevas };
            productores = {
                findById: jest.fn(),
                findByUsuarioId: jest.fn().mockResolvedValue(PRODUCTOR),
                findByTelefono: jest.fn(),
                findAll: jest.fn(),
                guardar: jest.fn(),
            };
        });

        const consultaModelos = (): IConsultaModelos => ({ obtenerIdPorVersion });
        const recibir = (capturas: CapturaEntrada[]) =>
            new RecibirCapturasService(repositorio, consultaModelos(), productores).ejecutar({
                usuarioId: "u-prod",
                capturas,
            });

        it("acepta las capturas nuevas y las guarda en un solo insert", async () => {
            const { results } = await recibir([captura("c-1"), captura("c-2")]);

            expect(results.map((r) => r.status)).toEqual(["accepted", "accepted"]);
            expect(results[0]).toMatchObject({ id: "c-1", uploadUrl: null, reason: null });
            expect(insertarNuevas).toHaveBeenCalledTimes(1);
            expect(insertarNuevas.mock.calls[0][0][0]).toMatchObject({ municipio: "Pitalito", modeloId: "m-1" });
        });

        it("consulta la versión del modelo una sola vez por lote", async () => {
            await recibir([captura("c-1"), captura("c-2"), captura("c-3")]);

            expect(obtenerIdPorVersion).toHaveBeenCalledTimes(1);
        });

        it("una captura ya recibida vuelve como duplicate con su serverId", async () => {
            findExistentes.mockResolvedValue([{ id: "d-9", idCliente: "c-1", productorId: "p-1" }]);

            const { results } = await recibir([captura("c-1")]);

            expect(results[0]).toMatchObject({ status: "duplicate", serverId: "d-9" });
            expect(insertarNuevas.mock.calls[0][0]).toHaveLength(0);
        });

        it("nunca revela la captura de otro productor con el mismo id", async () => {
            findExistentes.mockResolvedValue([{ id: "d-9", idCliente: "c-1", productorId: "p-otro" }]);

            const { results } = await recibir([captura("c-1")]);

            expect(results[0]).toMatchObject({ status: "rejected", reason: "id_en_uso", serverId: null });
        });

        it("un rechazo no tumba el resto del lote", async () => {
            const { results } = await recibir([captura("c-1", { confianza: 7 }), captura("c-2")]);

            expect(results).toEqual([
                expect.objectContaining({ id: "c-1", status: "rejected", reason: "confianza_invalida" }),
                expect.objectContaining({ id: "c-2", status: "accepted" }),
            ]);
        });

        it("si otra petición guardó la captura primero, responde duplicate", async () => {
            insertarNuevas.mockResolvedValue(new Set());
            findExistentes
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([{ id: "d-ganadora", idCliente: "c-1", productorId: "p-1" }]);

            const { results } = await recibir([captura("c-1")]);

            expect(results[0]).toMatchObject({ status: "duplicate", serverId: "d-ganadora" });
        });

        it("sin perfil de productor rechaza todo el lote", async () => {
            productores.findByUsuarioId.mockResolvedValue(null);

            const { results } = await recibir([captura("c-1")]);

            expect(results[0]).toMatchObject({ status: "rejected", reason: "perfil_incompleto" });
            expect(insertarNuevas).not.toHaveBeenCalled();
        });

        it("una versión fuera del inventario se guarda igual, sin modelo asociado", async () => {
            obtenerIdPorVersion.mockResolvedValue(null);

            await recibir([captura("c-1", { modeloVersion: "0.9.0-fabrica" })]);

            expect(insertarNuevas.mock.calls[0][0][0]).toMatchObject({
                modeloId: null,
                modeloVersion: "0.9.0-fabrica",
            });
        });
    });

    describe("Monitor (RF-07.2 a RF-07.4)", () => {
        let lectura: jest.Mocked<ILecturaDetecciones>;

        beforeEach(() => {
            lectura = {
                listar: jest.fn().mockResolvedValue({ total: 1, filas: [leida()] }),
                obtener: jest.fn().mockResolvedValue(null),
                resumir: jest.fn().mockResolvedValue([
                    { categoria: "enfermedad", total: 8, divergentes: 2, defectuosas: 1 },
                    { categoria: "sano", total: 4, divergentes: 1, defectuosas: 0 },
                ]),
            };
        });

        it("el listado incluye la revisión humana y no expone el embedding", async () => {
            lectura.listar.mockResolvedValue({
                total: 1,
                filas: [leida({ resultadoAgronomo: "Corrige diagnóstico IA", solicitudId: "s-1" })],
            });

            const pagina = await new ListarDeteccionesService(lectura).ejecutar({ filtros: {}, pagina: 1, limite: 20 });

            expect(pagina.datos[0].revision).toMatchObject({
                estado: "divergente",
                origen: "agronomo",
                solicitudId: "s-1",
            });
            expect(pagina.datos[0]).not.toHaveProperty("embedding");
            expect(pagina).toMatchObject({ total: 1, pagina: 1, limite: 20 });
        });

        it("rechaza incluir y excluir la misma categoría", async () => {
            await expect(
                new ListarDeteccionesService(lectura).ejecutar({
                    filtros: { incluir: ["plaga", "sano"], excluir: ["sano"] },
                    pagina: 1,
                    limite: 20,
                }),
            ).rejects.toBeInstanceOf(BadRequestException);
            expect(lectura.listar.mock.calls).toHaveLength(0);
        });

        it("rechaza un rango de fechas invertido", async () => {
            await expect(
                new ResumirDeteccionesService(lectura).ejecutar({
                    desde: new Date("2026-09-30"),
                    hasta: new Date("2026-09-01"),
                }),
            ).rejects.toBeInstanceOf(BadRequestException);
        });

        it("el resumen suma los totales de cada categoría", async () => {
            const resumen = await new ResumirDeteccionesService(lectura).ejecutar({});

            expect(resumen).toMatchObject({ total: 12, divergentes: 3, defectuosas: 1 });
            expect(resumen.porCategoria).toHaveLength(2);
        });

        it("devuelve 404 si la detección no existe", async () => {
            await expect(new ObtenerDeteccionService(lectura).ejecutar("d-x")).rejects.toBeInstanceOf(
                NotFoundException,
            );
        });
    });
});
