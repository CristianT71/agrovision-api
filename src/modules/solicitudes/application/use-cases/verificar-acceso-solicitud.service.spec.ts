import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { VerificarAccesoSolicitudService } from "./verificar-acceso-solicitud.service";
import { ObtenerSolicitudPorIdService } from "./obtener-solicitud-por-id.service";
import { ListarFotosSolicitudService } from "./listar-fotos-solicitud.service";
import { DescargarFotoSolicitudService } from "./descargar-foto-solicitud.service";
import { CasosSimilaresService } from "./casos-similares.service";
import { AnexosResolucionService } from "./anexos-resolucion.service";
import { ListarSolicitudesService } from "./listar-solicitudes.service";
import { Solicitud } from "../../domain/entities/solicitud.entity";
import { FotoSolicitud } from "../../domain/entities/foto-solicitud.entity";
import { AnexoResolucion } from "../../domain/entities/anexo-resolucion.entity";
import type {
    FiltrosLecturaSolicitudes,
    ILecturaSolicitudes,
    SolicitudConProductor,
} from "../../domain/ports/out/lectura-solicitudes.port";
import type { ISolicitudAppRepository } from "../../domain/ports/out/solicitud-app.repository";
import type { IAgronomoRepository } from "../../../agronomos/domain/ports/out/agronomo.repository";
import type { IAlmacenamientoArchivos } from "../../../../common/almacenamiento/almacenamiento.port";

type Usuario = { id: string; rol: string };

const ADMIN: Usuario = { id: "u-admin", rol: "admin" };
// La cuenta "u-a-1" es el agrónomo "a-1"; "u-a-2" es el agrónomo "a-2"
const AGRONOMO: Usuario = { id: "u-a-1", rol: "agronomo" };

const crearSolicitud = (id: string, agronomoId: string | null) =>
    new Solicitud(
        id,
        "p-1",
        agronomoId,
        agronomoId ? "Asignada" : "Enviada",
        new Date(),
        "Pitalito",
        "El Cedro",
        "La Esperanza",
        0.87,
        "m-1",
    );

describe("Acceso a las solicitudes del panel", () => {
    let expedientes: Map<string, SolicitudConProductor>;
    let agronomoIdDeCuenta: Map<string, string>;
    let listar: jest.Mock<Promise<SolicitudConProductor[]>, [FiltrosLecturaSolicitudes]>;
    let lecturasDeDatos: jest.Mock[];

    let verificarAcceso: VerificarAccesoSolicitudService;
    let obtener: ObtenerSolicitudPorIdService;
    let listarFotos: ListarFotosSolicitudService;
    let descargarFoto: DescargarFotoSolicitudService;
    let similares: CasosSimilaresService;
    let anexos: AnexosResolucionService;
    let listarSolicitudes: ListarSolicitudesService;

    beforeEach(() => {
        expedientes = new Map(
            [crearSolicitud("s-mia", "a-1"), crearSolicitud("s-otra", "a-2"), crearSolicitud("s-libre", null)].map(
                (solicitud) => [solicitud.id, { solicitud, productorNombre: "Carlos Arango" }],
            ),
        );
        agronomoIdDeCuenta = new Map([
            ["u-a-1", "a-1"],
            ["u-a-2", "a-2"],
        ]);

        listar = jest.fn<Promise<SolicitudConProductor[]>, [FiltrosLecturaSolicitudes]>(() => Promise.resolve([]));
        const listarResueltas = jest.fn(() => Promise.resolve([]));
        const listarAnexos = jest.fn((solicitudId: string) =>
            Promise.resolve([
                new AnexoResolucion("x-1", solicitudId, "ruta/x-1", "informe.pdf", "application/pdf", 10, new Date()),
            ]),
        );
        const obtenerAnexo = jest.fn((solicitudId: string, anexoId: string) =>
            Promise.resolve(
                new AnexoResolucion(anexoId, solicitudId, "ruta/x-1", "informe.pdf", "application/pdf", 10, new Date()),
            ),
        );
        const listarFotosRepo = jest.fn(() => Promise.resolve([]));
        // Cada solicitud tiene una foto subida con id "f-<solicitud>"
        const findFotoById = jest.fn((id: string) =>
            Promise.resolve(
                new FotoSolicitud(id, id.slice(2), "c-1", "HAZ", 1, `ruta/${id}`, "image/jpeg", 10, new Date()),
            ),
        );
        const leerPrivado = jest.fn(() => Promise.resolve(Buffer.from("archivo")));
        lecturasDeDatos = [listarResueltas, listarAnexos, obtenerAnexo, listarFotosRepo, findFotoById, leerPrivado];

        const lectura = {
            obtener: (id: string) => Promise.resolve(expedientes.get(id) ?? null),
            listar,
            listarResueltas,
            listarAnexos,
            obtenerAnexo,
        } as unknown as ILecturaSolicitudes;
        const agronomos = {
            findByUsuarioId: (usuarioId: string) => {
                const id = agronomoIdDeCuenta.get(usuarioId);
                return Promise.resolve(id ? { id } : null);
            },
        } as unknown as IAgronomoRepository;
        const appRepository = { listarFotos: listarFotosRepo, findFotoById } as unknown as ISolicitudAppRepository;
        const almacenamiento = { leerPrivado } as unknown as IAlmacenamientoArchivos;

        verificarAcceso = new VerificarAccesoSolicitudService(lectura, agronomos);
        obtener = new ObtenerSolicitudPorIdService(lectura, verificarAcceso);
        listarFotos = new ListarFotosSolicitudService(verificarAcceso, appRepository);
        descargarFoto = new DescargarFotoSolicitudService(appRepository, almacenamiento, verificarAcceso);
        similares = new CasosSimilaresService(lectura, verificarAcceso);
        anexos = new AnexosResolucionService(lectura, almacenamiento, verificarAcceso);
        listarSolicitudes = new ListarSolicitudesService(lectura, agronomos);
    });

    // Los endpoints de una sola solicitud: todos pasan por la verificación
    const ENDPOINTS: [string, (usuario: Usuario, solicitudId: string) => Promise<unknown>][] = [
        ["GET /solicitudes/:id", (usuario, id) => obtener.ejecutar(usuario, id)],
        ["GET /solicitudes/:id/fotos", (usuario, id) => listarFotos.ejecutar(usuario, id)],
        [
            "GET /solicitudes/:id/fotos/:fotoId",
            (usuario, id) => descargarFoto.ejecutar(usuario, { solicitudId: id, fotoId: `f-${id}` }),
        ],
        ["GET /solicitudes/:id/similares", (usuario, id) => similares.ejecutar(usuario, id)],
        ["GET /solicitudes/:id/anexos", (usuario, id) => anexos.listar(usuario, id)],
        ["GET /solicitudes/:id/anexos/:anexoId", (usuario, id) => anexos.descargar(usuario, id, "x-1")],
    ];

    describe("VerificarAccesoSolicitudService", () => {
        it("el administrador accede a cualquier solicitud y recibe la solicitud ya leída", async () => {
            const acceso = await verificarAcceso.ejecutar(ADMIN, "s-libre");

            expect(acceso.solicitud.id).toBe("s-libre");
            expect(acceso.productorNombre).toBe("Carlos Arango");
            expect(acceso.agronomoId).toBeNull();
        });

        it("el agrónomo accede a la solicitud que tiene asignada", async () => {
            const acceso = await verificarAcceso.ejecutar(AGRONOMO, "s-mia");

            expect(acceso.solicitud.id).toBe("s-mia");
            expect(acceso.agronomoId).toBe("a-1");
        });

        it.each([
            ["asignada a otro agrónomo", "s-otra"],
            ["sin asignar", "s-libre"],
            ["que no existe", "s-nada"],
        ])("al agrónomo una solicitud %s le responde 404 con el mismo mensaje", async (_, id) => {
            await expect(verificarAcceso.ejecutar(AGRONOMO, id)).rejects.toThrow(
                new NotFoundException(`La solicitud con ID ${id} no fue encontrada.`),
            );
        });

        it("el administrador recibe 404 si la solicitud no existe", async () => {
            await expect(verificarAcceso.ejecutar(ADMIN, "s-nada")).rejects.toBeInstanceOf(NotFoundException);
        });

        it("un agrónomo sin perfil recibe 403", async () => {
            agronomoIdDeCuenta.clear();

            await expect(verificarAcceso.ejecutar(AGRONOMO, "s-mia")).rejects.toBeInstanceOf(ForbiddenException);
        });

        it("cualquier otro rol recibe 403", async () => {
            await expect(verificarAcceso.ejecutar({ id: "u-p", rol: "productor" }, "s-mia")).rejects.toBeInstanceOf(
                ForbiddenException,
            );
        });
    });

    describe.each(ENDPOINTS)("%s", (_, llamar) => {
        it("el agrónomo asignado accede", async () => {
            await expect(llamar(AGRONOMO, "s-mia")).resolves.toBeDefined();
        });

        it("el administrador accede a cualquier solicitud", async () => {
            await expect(llamar(ADMIN, "s-mia")).resolves.toBeDefined();
            await expect(llamar(ADMIN, "s-otra")).resolves.toBeDefined();
        });

        it.each(["s-otra", "s-libre"])("el agrónomo recibe 404 en %s y no se lee ningún dato", async (id) => {
            await expect(llamar(AGRONOMO, id)).rejects.toBeInstanceOf(NotFoundException);

            for (const lectura of lecturasDeDatos) {
                expect(lectura).not.toHaveBeenCalled();
            }
        });
    });

    describe("GET /solicitudes", () => {
        it("el agrónomo solo recibe las suyas aunque mande ?agronomoId=<otro>", async () => {
            await listarSolicitudes.ejecutar({ agronomoId: "a-2", usuario: AGRONOMO });

            expect(listar).toHaveBeenCalledWith(expect.objectContaining({ agronomoId: "a-1" }));
        });

        it("al agrónomo se le filtra por su perfil aunque no pida soloMias", async () => {
            await listarSolicitudes.ejecutar({ estado: "Asignada", usuario: AGRONOMO });

            expect(listar).toHaveBeenCalledWith(expect.objectContaining({ agronomoId: "a-1", estado: "Asignada" }));
        });

        it("el administrador ve todas y puede filtrar por cualquier agrónomo", async () => {
            await listarSolicitudes.ejecutar({ usuario: ADMIN });
            await listarSolicitudes.ejecutar({ agronomoId: "a-2", usuario: ADMIN });

            expect(listar.mock.calls[0][0].agronomoId).toBeUndefined();
            expect(listar.mock.calls[1][0].agronomoId).toBe("a-2");
        });

        it("un agrónomo sin perfil recibe 403", async () => {
            agronomoIdDeCuenta.clear();

            await expect(listarSolicitudes.ejecutar({ usuario: AGRONOMO })).rejects.toBeInstanceOf(ForbiddenException);
            expect(listar).not.toHaveBeenCalled();
        });

        it("listarPorAgronomo, de uso interno, filtra por el agrónomo que recibe", async () => {
            await listarSolicitudes.listarPorAgronomo("a-2");

            expect(listar).toHaveBeenCalledWith({ agronomoId: "a-2" });
        });
    });
});
