import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { ResolverSolicitudService } from "./resolver-solicitud.service";
import { ListarSolicitudesService } from "./listar-solicitudes.service";
import type {
    FiltrosLecturaSolicitudes,
    ILecturaSolicitudes,
    SolicitudConProductor,
} from "../../domain/ports/out/lectura-solicitudes.port";
import { Solicitud, type EstadoSolicitud } from "../../domain/entities/solicitud.entity";
import type { ISolicitudRepository, FiltrosSolicitud } from "../../domain/ports/out/solicitud.repository";
import type { IAgronomoRepository } from "../../../agronomos/domain/ports/out/agronomo.repository";
import { Agronomo, type EstadoAgronomo } from "../../../agronomos/domain/entities/agronomo.entity";
import { ReglaNegocioError } from "../../../../common/errors/regla-negocio.error";
import type { AnexoResolucion } from "../../domain/entities/anexo-resolucion.entity";
import type {
    ArchivoParaGuardar,
    IAlmacenamientoArchivos,
} from "../../../../common/almacenamiento/almacenamiento.port";

const RESOLUCION = {
    respuestaProfesional: "Se confirma roya en estadio inicial, aplicar fungicida cúprico.",
    tipoResultado: "Confirma diagnóstico IA" as const,
    plagaIdentificada: "Roya del cafeto",
};

const crearSolicitud = (estado: EstadoSolicitud, agronomoId: string | null) =>
    new Solicitud("s-1", "p-1", agronomoId, estado, new Date(), "Pitalito", "El Cedro", "La Esperanza", 0.87, "m-1");

const crearAgronomo = (id: string, estado: EstadoAgronomo = "activo") =>
    new Agronomo(
        id,
        `u-${id}`,
        "Claudia Ríos",
        `TP-${id}`,
        "+573001",
        `${id}@a.co`,
        "Fitopatología",
        estado,
        new Date(),
    );

describe("Solicitudes - casos de uso", () => {
    let solicitud: Solicitud | null;
    let agronomo: Agronomo | null;
    let guardarResolucion: jest.Mock<Promise<boolean>, [Solicitud, AnexoResolucion[]?]>;
    let guardarPrivado: jest.Mock<Promise<string>, [string, ArchivoParaGuardar]>;
    let eliminarPrivado: jest.Mock<Promise<void>, [string]>;
    let almacenamiento: IAlmacenamientoArchivos;
    let findAll: jest.Mock<Promise<Solicitud[]>, [FiltrosSolicitud?]>;
    let solicitudes: ISolicitudRepository;
    let agronomos: IAgronomoRepository;
    let listarLectura: jest.Mock<Promise<SolicitudConProductor[]>, [FiltrosLecturaSolicitudes]>;
    let lectura: ILecturaSolicitudes;

    beforeEach(() => {
        solicitud = crearSolicitud("Asignada", "a-1");
        agronomo = crearAgronomo("a-1");
        guardarResolucion = jest.fn<Promise<boolean>, [Solicitud, AnexoResolucion[]?]>(() => Promise.resolve(true));
        guardarPrivado = jest.fn<Promise<string>, [string, ArchivoParaGuardar]>((carpeta) =>
            Promise.resolve(`${carpeta}/archivo.pdf`),
        );
        eliminarPrivado = jest.fn<Promise<void>, [string]>(() => Promise.resolve());
        almacenamiento = {
            guardarPublico: jest.fn(),
            eliminarPublico: jest.fn(),
            guardarPrivado,
            leerPrivado: jest.fn(),
            eliminarPrivado,
        };
        findAll = jest.fn(() => Promise.resolve([]));

        solicitudes = {
            findById: () => Promise.resolve(solicitud),
            findAll,
            guardar: jest.fn(),
            guardarResolucion,
            guardarAsignacion: jest.fn(),
        };
        agronomos = { findByUsuarioId: () => Promise.resolve(agronomo) } as unknown as IAgronomoRepository;
        listarLectura = jest.fn<Promise<SolicitudConProductor[]>, [FiltrosLecturaSolicitudes]>(() =>
            Promise.resolve([]),
        );
        lectura = {
            listar: listarLectura,
            obtener: jest.fn(),
            listarAnexos: jest.fn(),
            listarResueltas: jest.fn(),
            obtenerAnexo: jest.fn(),
        };
    });

    describe("ResolverSolicitudService", () => {
        const PDF: ArchivoParaGuardar = {
            nombreOriginal: "informe.pdf",
            tipoMime: "application/pdf",
            contenido: Buffer.from("%PDF-1.7"),
        };

        const resolver = (anexos: ArchivoParaGuardar[] = []) =>
            new ResolverSolicitudService(solicitudes, agronomos, almacenamiento).ejecutar({
                solicitudId: "s-1",
                usuarioId: "u-a-1",
                ...RESOLUCION,
                anexos,
            });

        it("resuelve la solicitud asignada al agrónomo autenticado", async () => {
            await resolver();

            const guardada = guardarResolucion.mock.calls[0][0];
            expect(guardada.estado).toBe("Resuelta");
            expect(guardada.plagaIdentificada).toBe("Roya del cafeto");
            expect(guardada.fechaResolucion).toBeInstanceOf(Date);
        });

        it("no deja resolver una solicitud asignada a otro agrónomo", async () => {
            solicitud = crearSolicitud("Asignada", "a-2");

            await expect(resolver()).rejects.toBeInstanceOf(ForbiddenException);
            expect(guardarResolucion).not.toHaveBeenCalled();
        });

        it("no deja resolver a un agrónomo inactivo", async () => {
            agronomo = crearAgronomo("a-1", "inactivo");

            await expect(resolver()).rejects.toBeInstanceOf(ForbiddenException);
        });

        it("responde 404 si la solicitud no existe", async () => {
            solicitud = null;

            await expect(resolver()).rejects.toBeInstanceOf(NotFoundException);
        });

        it("impide modificar una solicitud ya resuelta (RF-04.8)", async () => {
            solicitud = crearSolicitud("Resuelta", "a-1");

            await expect(resolver()).rejects.toBeInstanceOf(ReglaNegocioError);
        });

        it("responde 409 si otra petición la resolvió primero", async () => {
            guardarResolucion.mockResolvedValue(false);

            await expect(resolver()).rejects.toBeInstanceOf(ConflictException);
        });

        it("guarda los anexos en almacenamiento privado junto con la resolución (RF-04.6)", async () => {
            await resolver([PDF, PDF]);

            const anexos = guardarResolucion.mock.calls[0][1] ?? [];
            expect(anexos).toHaveLength(2);
            expect(anexos[0].nombreOriginal).toBe("informe.pdf");
            expect(guardarPrivado).toHaveBeenCalledWith("solicitudes/s-1/anexos", PDF);
            expect(eliminarPrivado).not.toHaveBeenCalled();
        });

        it("si la resolución no se guarda, borra los anexos que alcanzó a subir", async () => {
            guardarResolucion.mockResolvedValue(false);

            await expect(resolver([PDF])).rejects.toBeInstanceOf(ConflictException);
            expect(eliminarPrivado).toHaveBeenCalledWith("solicitudes/s-1/anexos/archivo.pdf");
        });

        it("no sube anexos si la solicitud no puede resolverse", async () => {
            solicitud = crearSolicitud("Asignada", "a-2");

            await expect(resolver([PDF])).rejects.toBeInstanceOf(ForbiddenException);
            expect(guardarPrivado).not.toHaveBeenCalled();
        });

        it("rechaza más de 5 anexos", async () => {
            await expect(resolver([PDF, PDF, PDF, PDF, PDF, PDF])).rejects.toThrow("máximo 5");
            expect(guardarPrivado).not.toHaveBeenCalled();
        });
    });

    describe("ListarSolicitudesService", () => {
        const listar = (soloMias: boolean, rol: string) =>
            new ListarSolicitudesService(lectura, agronomos).ejecutar({
                soloMias,
                agronomoId: "a-otro",
                usuario: { id: "u-a-1", rol },
            });

        it("'mis asignadas' usa el agrónomo del token e ignora el enviado por el cliente", async () => {
            await listar(true, "agronomo");

            expect(listarLectura).toHaveBeenCalledWith(expect.objectContaining({ agronomoId: "a-1" }));
        });

        it("'mis asignadas' no aplica a administradores", async () => {
            await expect(listar(true, "admin")).rejects.toBeInstanceOf(ForbiddenException);
        });

        it("entrega cada solicitud con el nombre de su productor y pasa la búsqueda (RF-03.5)", async () => {
            listarLectura.mockResolvedValue([
                { solicitud: crearSolicitud("Enviada", null), productorNombre: "Carlos Arango" },
            ]);

            const [vista] = await new ListarSolicitudesService(lectura, agronomos).ejecutar({
                busqueda: "carlos",
                usuario: { id: "u-a-1", rol: "admin" },
            });

            expect(vista.productorNombre).toBe("Carlos Arango");
            expect(listarLectura).toHaveBeenCalledWith(expect.objectContaining({ busqueda: "carlos" }));
        });
    });
});
