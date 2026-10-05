import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { RecibirLoteSolicitudesService } from "./recibir-lote-solicitudes.service";
import { SubirFotoSolicitudService } from "./subir-foto-solicitud.service";
import { ListarMisSolicitudesService } from "./listar-mis-solicitudes.service";
import { ListarFotosSolicitudService } from "./listar-fotos-solicitud.service";
import { DescargarFotoSolicitudService } from "./descargar-foto-solicitud.service";
import { Solicitud, type EstadoSolicitud } from "../../domain/entities/solicitud.entity";
import { FotoSolicitud } from "../../domain/entities/foto-solicitud.entity";
import type { SolicitudAppEntrada } from "../../domain/ports/in/solicitudes-app.port";
import type { ISolicitudAppRepository } from "../../domain/ports/out/solicitud-app.repository";
import type { ISolicitudRepository } from "../../domain/ports/out/solicitud.repository";
import type { IFirmadorUrlsSubida } from "../../domain/ports/out/firmador-urls-subida.port";
import type { IProductorRepository } from "../../../productores/domain/ports/out/productor.repository";
import { Productor } from "../../../productores/domain/entities/productor.entity";
import type {
    ArchivoParaGuardar,
    IAlmacenamientoArchivos,
} from "../../../../common/almacenamiento/almacenamiento.port";
import type { ArchivoSubido } from "../../../../common/almacenamiento/validar-archivo";

// uuid se publica como ESM y Jest no lo carga: se reemplaza por el generador nativo
jest.mock("uuid", () => ({ v4: () => crypto.randomUUID() }));

const PRODUCTOR = new Productor(
    "p-1",
    "u-1",
    "Ana Muñoz",
    "La Esperanza",
    "El Cedro",
    "Pitalito",
    "+573001112233",
    "validado",
    true,
    new Date(),
);

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

const entrada = (idCliente: string, cantidadFotos = 2): SolicitudAppEntrada => ({
    idCliente,
    capturaId: null,
    cultivo: "CAFE",
    organo: "HOJA",
    nota: "Manchas en el haz",
    creadaEn: 1_750_000_000_000,
    ubicacion: { latitud: 1.85, longitud: -76.05, precisionMetros: 10 },
    fotos: Array.from({ length: cantidadFotos }, (_, indice) => ({
        idCliente: `${idCliente}-img-${indice + 1}`,
        angulo: "GENERAL" as const,
    })),
});

const crearSolicitud = (cambios: { id?: string; estado?: EstadoSolicitud; productorId?: string } = {}) =>
    new Solicitud(
        cambios.id ?? "s-1",
        cambios.productorId ?? "p-1",
        null,
        cambios.estado ?? "Pendiente",
        new Date(),
        "Pitalito",
        "El Cedro",
        "La Esperanza",
        null,
        null,
        null,
        null,
        null,
        null,
        "c-1",
    );

const crearFoto = (id: string, orden: number, subida = false, solicitudId = "s-1") =>
    new FotoSolicitud(
        id,
        solicitudId,
        `img-${orden}`,
        "HAZ",
        orden,
        subida ? `solicitudes/${solicitudId}/${id}.jpg` : null,
        subida ? "image/jpeg" : null,
        subida ? 100 : null,
        subida ? new Date() : null,
    );

describe("Solicitudes desde la app móvil - casos de uso", () => {
    let productor: Productor | null;
    let solicitudes: Map<string, Solicitud>;
    let fotos: FotoSolicitud[];
    let appRepository: ISolicitudAppRepository;
    let solicitudRepository: ISolicitudRepository;
    let productores: IProductorRepository;
    let firmador: IFirmadorUrlsSubida;
    let almacenamiento: IAlmacenamientoArchivos;
    // Mocks sueltos para las aserciones: evita referenciar métodos del objeto (unbound-method)
    let crearConFotos: jest.Mock<Promise<boolean>, [Solicitud, FotoSolicitud[]]>;
    let listarPorProductor: jest.Mock<Promise<Solicitud[]>, [string, Date?]>;
    let marcarFotoSubida: jest.Mock<Promise<boolean>, [FotoSolicitud]>;
    let guardarEnvio: jest.Mock<Promise<boolean>, [Solicitud]>;
    let verificar: jest.Mock<string | null, [string]>;
    let guardarPrivado: jest.Mock<Promise<string>, [string, ArchivoParaGuardar]>;
    let eliminarPrivado: jest.Mock<Promise<void>, [string]>;

    beforeEach(() => {
        productor = PRODUCTOR;
        solicitudes = new Map();
        fotos = [];

        crearConFotos = jest.fn((solicitud: Solicitud, nuevas: FotoSolicitud[]) => {
            solicitudes.set(solicitud.idCliente ?? "", solicitud);
            fotos.push(...nuevas);
            return Promise.resolve(true);
        });
        listarPorProductor = jest.fn<Promise<Solicitud[]>, [string, Date?]>(() => Promise.resolve([]));
        marcarFotoSubida = jest.fn<Promise<boolean>, [FotoSolicitud]>(() => Promise.resolve(true));
        guardarEnvio = jest.fn<Promise<boolean>, [Solicitud]>(() => Promise.resolve(true));
        verificar = jest.fn<string | null, [string]>(() => "f-1");
        guardarPrivado = jest.fn<Promise<string>, [string, ArchivoParaGuardar]>(() =>
            Promise.resolve("solicitudes/s-1/nueva.jpg"),
        );
        eliminarPrivado = jest.fn<Promise<void>, [string]>(() => Promise.resolve());

        appRepository = {
            findByIdCliente: (idCliente: string) => Promise.resolve(solicitudes.get(idCliente) ?? null),
            crearConFotos,
            listarPorProductor,
            listarFotos: (solicitudId: string) =>
                Promise.resolve(fotos.filter((foto) => foto.solicitudId === solicitudId)),
            findFotoById: (id: string) => Promise.resolve(fotos.find((foto) => foto.id === id) ?? null),
            marcarFotoSubida,
            guardarEnvio,
        };
        solicitudRepository = {
            findById: (id: string) =>
                Promise.resolve([...solicitudes.values()].find((solicitud) => solicitud.id === id) ?? null),
            findAll: jest.fn(),
            guardar: jest.fn(),
            guardarResolucion: jest.fn(),
            guardarAsignacion: jest.fn(),
        };
        productores = { findByUsuarioId: () => Promise.resolve(productor) } as unknown as IProductorRepository;
        firmador = { firmar: (fotoId: string) => `http://api/v1/uploads/token-${fotoId}`, verificar };
        almacenamiento = {
            guardarPublico: jest.fn(),
            eliminarPublico: jest.fn(),
            guardarPrivado,
            leerPrivado: jest.fn().mockResolvedValue(JPEG),
            eliminarPrivado,
        };
    });

    describe("RecibirLoteSolicitudesService", () => {
        const recibir = (lote: SolicitudAppEntrada[]) =>
            new RecibirLoteSolicitudesService(appRepository, productores, firmador).ejecutar({
                usuarioId: "u-1",
                solicitudes: lote,
            });

        it("acepta la solicitud y devuelve una URL por foto, sin uploadUrl general", async () => {
            const { results } = await recibir([entrada("c-1", 3)]);

            expect(results).toHaveLength(1);
            const [resultado] = results;
            expect(resultado.status).toBe("accepted");
            expect(resultado.id).toBe("c-1");
            expect(resultado.serverId).toEqual(expect.any(String));
            expect(resultado.uploadUrl).toBeNull();
            expect(resultado.imageUploads?.map((subida) => subida.imageId)).toEqual([
                "c-1-img-1",
                "c-1-img-2",
                "c-1-img-3",
            ]);
            expect(
                resultado.imageUploads?.every((subida) => subida.uploadUrl.startsWith("http://api/v1/uploads/")),
            ).toBe(true);

            const [solicitud, creadas] = crearConFotos.mock.calls[0];
            expect(solicitud.estado).toBe("Pendiente");
            expect(solicitud.finca).toBe("La Esperanza");
            expect(creadas).toHaveLength(3);
        });

        it("una solicitud repetida sale como duplicate con el mismo serverId y URLs solo de las fotos pendientes", async () => {
            const primera = (await recibir([entrada("c-1", 3)])).results[0];
            // La app subió la primera foto y perdió la respuesta del lote
            fotos[0].marcarSubida("solicitudes/x/1.jpg", "image/jpeg", 100);

            const segunda = (await recibir([entrada("c-1", 3)])).results[0];

            expect(segunda.status).toBe("duplicate");
            expect(segunda.serverId).toBe(primera.serverId);
            expect(segunda.imageUploads?.map((subida) => subida.imageId)).toEqual(["c-1-img-2", "c-1-img-3"]);
            expect(crearConFotos).toHaveBeenCalledTimes(1);
        });

        it("una solicitud rechazada no afecta a las demás del lote", async () => {
            const { results } = await recibir([entrada("c-1"), entrada("c-2", 1), entrada("c-3")]);

            expect(results.map((resultado) => [resultado.id, resultado.status, resultado.reason])).toEqual([
                ["c-1", "accepted", null],
                ["c-2", "rejected", "imagenes_insuficientes"],
                ["c-3", "accepted", null],
            ]);
            expect(results[1].serverId).toBeNull();
            expect(crearConFotos).toHaveBeenCalledTimes(2);
        });

        it("rechaza todo el lote con perfil_incompleto si el usuario no tiene perfil de productor", async () => {
            productor = null;

            const { results } = await recibir([entrada("c-1"), entrada("c-2")]);

            expect(results.map((resultado) => [resultado.status, resultado.reason])).toEqual([
                ["rejected", "perfil_incompleto"],
                ["rejected", "perfil_incompleto"],
            ]);
            expect(crearConFotos).not.toHaveBeenCalled();
        });

        it("no revela una solicitud de otro productor que use el mismo id", async () => {
            solicitudes.set("c-1", crearSolicitud({ productorId: "p-otro" }));

            const [resultado] = (await recibir([entrada("c-1")])).results;

            expect(resultado).toMatchObject({ status: "rejected", reason: "id_en_uso", serverId: null });
        });

        it("si otra petición la creó primero, responde duplicate", async () => {
            crearConFotos.mockImplementationOnce((solicitud: Solicitud) => {
                solicitudes.set("c-1", solicitud);
                return Promise.resolve(false);
            });

            const [resultado] = (await recibir([entrada("c-1")])).results;

            expect(resultado.status).toBe("duplicate");
        });

        it("rechaza con 400 un lote de más de 20 solicitudes", async () => {
            const lote = Array.from({ length: 21 }, (_, indice) => entrada(`c-${indice}`));

            await expect(recibir(lote)).rejects.toThrow(BadRequestException);
        });
    });

    describe("SubirFotoSolicitudService", () => {
        const archivo = (contenido: Buffer = JPEG): ArchivoSubido => ({
            originalname: "foto",
            mimetype: "image/jpeg",
            size: contenido.length,
            buffer: contenido,
        });

        const subir = (contenido?: Buffer) =>
            new SubirFotoSolicitudService(appRepository, solicitudRepository, firmador, almacenamiento).ejecutar({
                token: "token",
                archivo: archivo(contenido),
            });

        beforeEach(() => {
            solicitudes.set("c-1", crearSolicitud());
            fotos.push(crearFoto("f-1", 1), crearFoto("f-2", 2));
        });

        it("responde 403 si el token no es válido o venció", async () => {
            verificar.mockReturnValue(null);

            await expect(subir()).rejects.toThrow(ForbiddenException);
            expect(guardarPrivado).not.toHaveBeenCalled();
        });

        it("responde 404 si la foto ya no existe", async () => {
            verificar.mockReturnValue("f-inexistente");

            await expect(subir()).rejects.toThrow(NotFoundException);
        });

        it("guarda la foto en almacenamiento privado sin enviar la solicitud si faltan otras", async () => {
            await subir();

            expect(guardarPrivado.mock.calls[0][0]).toBe("solicitudes/s-1");
            expect(guardarPrivado.mock.calls[0][1].tipoMime).toBe("image/jpeg");
            expect(marcarFotoSubida.mock.calls[0][0]).toMatchObject({
                id: "f-1",
                ruta: "solicitudes/s-1/nueva.jpg",
                tipoMime: "image/jpeg",
                tamanoBytes: JPEG.length,
            });
            expect(guardarEnvio).not.toHaveBeenCalled();
        });

        it("con la última foto pasa la solicitud a Enviada", async () => {
            fotos[1].marcarSubida("solicitudes/s-1/2.jpg", "image/jpeg", 100);

            await subir();

            expect(guardarEnvio).toHaveBeenCalledTimes(1);
            expect(guardarEnvio.mock.calls[0][0].estado).toBe("Enviada");
        });

        it("si la foto ya estaba subida responde OK sin guardarla de nuevo", async () => {
            fotos[0].marcarSubida("solicitudes/s-1/1.jpg", "image/jpeg", 100);

            await expect(subir()).resolves.toBeUndefined();

            expect(guardarPrivado).not.toHaveBeenCalled();
            expect(marcarFotoSubida).not.toHaveBeenCalled();
        });

        it("responde 400 si el archivo no es una imagen", async () => {
            await expect(subir(Buffer.from("%PDF-1.7"))).rejects.toThrow(BadRequestException);
            await expect(subir(Buffer.alloc(0))).rejects.toThrow(BadRequestException);

            expect(guardarPrivado).not.toHaveBeenCalled();
        });

        it("descarta su copia si otra subida simultánea de la misma foto ganó", async () => {
            marcarFotoSubida.mockResolvedValue(false);

            await subir();

            expect(eliminarPrivado).toHaveBeenCalledWith("solicitudes/s-1/nueva.jpg");
        });

        it("no deja el archivo huérfano si falla al registrarlo", async () => {
            marcarFotoSubida.mockRejectedValue(new Error("base de datos caída"));

            await expect(subir()).rejects.toThrow("base de datos caída");

            expect(eliminarPrivado).toHaveBeenCalledWith("solicitudes/s-1/nueva.jpg");
        });
    });

    describe("ListarMisSolicitudesService", () => {
        const listar = (desde?: number) =>
            new ListarMisSolicitudesService(appRepository, productores).ejecutar({ usuarioId: "u-1", desde });

        it("traduce cada estado al de la app y mapea la resolución", async () => {
            const resuelta = crearSolicitud({ estado: "Resuelta" });
            resuelta.tipoResultado = "Confirma diagnóstico IA";
            resuelta.respuestaProfesional = "Roya en estadio inicial.";
            resuelta.fechaResolucion = new Date(1_750_000_123_456);
            listarPorProductor.mockResolvedValue([
                crearSolicitud({ estado: "Pendiente" }),
                crearSolicitud({ estado: "Enviada" }),
                crearSolicitud({ estado: "Asignada" }),
                resuelta,
                crearSolicitud({ estado: "Descartada" }),
            ]);

            const mias = await listar();

            expect(mias.map((solicitud) => solicitud.status)).toEqual([
                "PENDING_UPLOAD",
                "SUBMITTED",
                "ASSIGNED",
                "RESOLVED",
                "DISCARDED",
            ]);
            expect(mias[3]).toEqual({
                id: "c-1",
                status: "RESOLVED",
                resolutionType: "Confirma diagnóstico IA",
                resolvedPestId: null,
                agronomistResponse: "Roya en estadio inicial.",
                resolvedAt: 1_750_000_123_456,
            });
            expect(mias[0]).toMatchObject({ resolutionType: null, agronomistResponse: null, resolvedAt: null });
        });

        it("filtra por since convirtiendo el epoch en fecha", async () => {
            await listar(1_750_000_000_000);

            expect(listarPorProductor).toHaveBeenCalledWith("p-1", new Date(1_750_000_000_000));
        });

        it("sin since pide todas las del productor", async () => {
            await listar();

            expect(listarPorProductor).toHaveBeenCalledWith("p-1", undefined);
        });

        it("sin perfil de productor devuelve una lista vacía", async () => {
            productor = null;

            await expect(listar()).resolves.toEqual([]);
            expect(listarPorProductor).not.toHaveBeenCalled();
        });
    });

    describe("Fotos en el panel", () => {
        beforeEach(() => {
            solicitudes.set("c-1", crearSolicitud());
            fotos.push(crearFoto("f-1", 1, true), crearFoto("f-2", 2), crearFoto("f-9", 1, true, "s-otra"));
        });

        it("lista las fotos de la solicitud sin exponer la ruta interna", async () => {
            const vista = await new ListarFotosSolicitudService(solicitudRepository, appRepository).ejecutar("s-1");

            expect(vista).toEqual([
                { id: "f-1", angulo: "HAZ", orden: 1, tipoMime: "image/jpeg", subida: true },
                { id: "f-2", angulo: "HAZ", orden: 2, tipoMime: null, subida: false },
            ]);
        });

        it("responde 404 al listar fotos de una solicitud que no existe", async () => {
            await expect(
                new ListarFotosSolicitudService(solicitudRepository, appRepository).ejecutar("s-nada"),
            ).rejects.toThrow(NotFoundException);
        });

        it("descarga una foto subida de la solicitud", async () => {
            const { foto, contenido } = await new DescargarFotoSolicitudService(appRepository, almacenamiento).ejecutar(
                {
                    solicitudId: "s-1",
                    fotoId: "f-1",
                },
            );

            expect(foto.id).toBe("f-1");
            expect(contenido).toEqual(JPEG);
        });

        it.each([
            ["de otra solicitud", "f-9"],
            ["que aún no se sube", "f-2"],
            ["que no existe", "f-x"],
        ])("responde 404 para una foto %s", async (_, fotoId) => {
            await expect(
                new DescargarFotoSolicitudService(appRepository, almacenamiento).ejecutar({
                    solicitudId: "s-1",
                    fotoId,
                }),
            ).rejects.toThrow(NotFoundException);
        });
    });
});
