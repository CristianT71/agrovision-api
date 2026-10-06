import { ForbiddenException } from "@nestjs/common";
import { ListarSolicitudesService } from "./listar-solicitudes.service";
import { Solicitud } from "../../domain/entities/solicitud.entity";
import type {
    FiltrosLecturaSolicitudes,
    ILecturaSolicitudes,
    PaginaLectura,
    SolicitudConProductor,
} from "../../domain/ports/out/lectura-solicitudes.port";
import type { IAgronomoRepository } from "../../../agronomos/domain/ports/out/agronomo.repository";

const ADMIN = { id: "u-admin", rol: "admin" };
const AGRONOMO = { id: "u-a-1", rol: "agronomo" };

const crearSolicitud = (id: string) =>
    new Solicitud(id, "p-1", null, "Enviada", new Date(), "Pitalito", "El Cedro", "La Esperanza", 0.87, "m-1");

describe("ListarSolicitudesService (RNF-03.1)", () => {
    let listarPagina: jest.Mock<
        Promise<{ total: number; resultados: SolicitudConProductor[] }>,
        [FiltrosLecturaSolicitudes, PaginaLectura]
    >;
    let agronomoId: string | null;
    let servicio: ListarSolicitudesService;

    beforeEach(() => {
        agronomoId = "a-1";
        listarPagina = jest.fn<
            Promise<{ total: number; resultados: SolicitudConProductor[] }>,
            [FiltrosLecturaSolicitudes, PaginaLectura]
        >(() =>
            Promise.resolve({
                total: 45,
                resultados: [{ solicitud: crearSolicitud("s-1"), productorNombre: "Carlos Arango" }],
            }),
        );

        const lectura = { listarPagina } as unknown as ILecturaSolicitudes;
        const agronomos = {
            findByUsuarioId: () => Promise.resolve(agronomoId ? { id: agronomoId } : null),
        } as unknown as IAgronomoRepository;
        servicio = new ListarSolicitudesService(lectura, agronomos);
    });

    it("responde { datos, total, pagina, limite } con el nombre del productor", async () => {
        const pagina = await servicio.ejecutar({ pagina: 3, limite: 20, usuario: ADMIN });

        expect(pagina).toMatchObject({ total: 45, pagina: 3, limite: 20 });
        expect(pagina.datos).toHaveLength(1);
        expect(pagina.datos[0]).toMatchObject({ id: "s-1", productorNombre: "Carlos Arango" });
    });

    it("pasa la página y el límite pedidos al repositorio", async () => {
        await servicio.ejecutar({ pagina: 3, limite: 15, usuario: ADMIN });

        expect(listarPagina.mock.calls[0][1]).toEqual({ numero: 3, limite: 15 });
    });

    it("sin página ni límite usa la página 1 de 20", async () => {
        const pagina = await servicio.ejecutar({ usuario: ADMIN });

        expect(listarPagina.mock.calls[0][1]).toEqual({ numero: 1, limite: 20 });
        expect(pagina).toMatchObject({ pagina: 1, limite: 20 });
    });

    it("nunca pide más de 100 por página", async () => {
        const pagina = await servicio.ejecutar({ limite: 5000, usuario: ADMIN });

        expect(listarPagina.mock.calls[0][1].limite).toBe(100);
        expect(pagina.limite).toBe(100);
    });

    it("el administrador filtra por estado, búsqueda, agrónomo y sin asignar", async () => {
        await servicio.ejecutar({
            estado: "Enviada",
            busqueda: "carlos",
            agronomoId: "a-2",
            sinAsignar: true,
            usuario: ADMIN,
        });

        expect(listarPagina.mock.calls[0][0]).toEqual({
            estado: "Enviada",
            busqueda: "carlos",
            agronomoId: "a-2",
            sinAsignar: true,
        });
    });

    it("el agrónomo solo ve lo suyo e ignora agronomoId y sinAsignar", async () => {
        await servicio.ejecutar({ estado: "Asignada", agronomoId: "a-2", sinAsignar: true, usuario: AGRONOMO });

        expect(listarPagina.mock.calls[0][0]).toEqual({ estado: "Asignada", busqueda: undefined, agronomoId: "a-1" });
    });

    it("un agrónomo sin perfil recibe 403 y no se consulta nada", async () => {
        agronomoId = null;

        await expect(servicio.ejecutar({ usuario: AGRONOMO })).rejects.toBeInstanceOf(ForbiddenException);
        expect(listarPagina).not.toHaveBeenCalled();
    });

    it("otro rol recibe 403", async () => {
        await expect(servicio.ejecutar({ usuario: { id: "u-p", rol: "productor" } })).rejects.toBeInstanceOf(
            ForbiddenException,
        );
    });
});
