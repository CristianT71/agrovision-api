import { NotFoundException } from "@nestjs/common";
import { ObtenerUbicacionSolicitudService } from "./obtener-ubicacion-solicitud.service";
import { VerificarAccesoSolicitudService } from "./verificar-acceso-solicitud.service";
import { ObtenerSolicitudPorIdService } from "./obtener-solicitud-por-id.service";
import { Solicitud } from "../../domain/entities/solicitud.entity";
import { Productor } from "../../../productores/domain/entities/productor.entity";
import type { SolicitudConProductor, ILecturaSolicitudes } from "../../domain/ports/out/lectura-solicitudes.port";
import type { ISolicitudRepository } from "../../domain/ports/out/solicitud.repository";
import type { IConsultarElevacion } from "../../domain/ports/out/consultar-elevacion.port";
import type {
    IAuditoriaUbicaciones,
    RegistroConsultaUbicacion,
} from "../../domain/ports/out/auditoria-ubicaciones.port";
import type { IProductorRepository } from "../../../productores/domain/ports/out/productor.repository";
import type { IAgronomoRepository } from "../../../agronomos/domain/ports/out/agronomo.repository";

type Usuario = { id: string; rol: string };

const ADMIN: Usuario = { id: "u-admin", rol: "admin" };
// La cuenta "u-a-1" es el agrónomo "a-1" (el asignado); "u-a-2" es "a-2"
const ASIGNADO: Usuario = { id: "u-a-1", rol: "agronomo" };
const AJENO: Usuario = { id: "u-a-2", rol: "agronomo" };

const crearSolicitud = (cambios: { latitud?: number | null; altitud?: number | null } = {}) =>
    new Solicitud(
        "11111111-1111-4111-8111-111111111111",
        "p-1",
        "a-1",
        "Asignada",
        new Date("2026-05-01T10:00:00Z"),
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
        null,
        "CAFE",
        "HOJA",
        null,
        cambios.latitud === undefined ? 1.85 : cambios.latitud,
        cambios.latitud === null ? null : -76.05,
        8,
        null,
        cambios.altitud ?? null,
        cambios.altitud === undefined || cambios.altitud === null ? null : "gps",
        false,
        true,
    );

const productor = (consentimiento: boolean) =>
    new Productor(
        "p-1",
        "u-1",
        "Ana & Muñoz",
        "La Esperanza",
        "El Cedro",
        "Pitalito",
        "+573001112233",
        "validado",
        consentimiento,
        null,
    );

describe("ObtenerUbicacionSolicitudService", () => {
    let solicitud: Solicitud;
    let consentimiento: boolean;
    let elevacion: jest.Mock<Promise<number | null>, [number, number]>;
    let guardarAltitudDeServicio: jest.Mock<Promise<boolean>, [string, number]>;
    let registrar: jest.Mock<Promise<void>, [RegistroConsultaUbicacion]>;
    let servicio: ObtenerUbicacionSolicitudService;
    let lectura: ILecturaSolicitudes;
    let agronomos: IAgronomoRepository;

    // Como la base de datos: cada consulta lee una fila nueva, con lo que ya se guardó
    let altitudGuardada: { metros: number } | null;

    const armar = () => {
        altitudGuardada = null;
        lectura = {
            obtener: (id: string): Promise<SolicitudConProductor | null> => {
                if (id !== solicitud.id) return Promise.resolve(null);
                const lectura = crearSolicitud({
                    latitud: solicitud.latitud,
                    altitud: solicitud.altitudMsnm ?? altitudGuardada?.metros ?? null,
                });
                if (altitudGuardada && solicitud.altitudMsnm === null) {
                    lectura.altitudOrigen = "servicio";
                }
                return Promise.resolve({ solicitud: lectura, productorNombre: "Ana & Muñoz" });
            },
        } as unknown as ILecturaSolicitudes;
        agronomos = {
            findByUsuarioId: (usuarioId: string) =>
                Promise.resolve(usuarioId === "u-a-1" ? { id: "a-1" } : usuarioId === "u-a-2" ? { id: "a-2" } : null),
        } as unknown as IAgronomoRepository;
        const productores = {
            findById: () => Promise.resolve(productor(consentimiento)),
        } as unknown as IProductorRepository;
        const repositorio = { guardarAltitudDeServicio } as unknown as ISolicitudRepository;
        const consultarElevacion: IConsultarElevacion = { consultar: elevacion };
        const auditoria: IAuditoriaUbicaciones = { registrar };

        servicio = new ObtenerUbicacionSolicitudService(
            new VerificarAccesoSolicitudService(lectura, agronomos),
            productores,
            repositorio,
            consultarElevacion,
            auditoria,
        );
    };

    beforeEach(() => {
        solicitud = crearSolicitud();
        consentimiento = true;
        elevacion = jest.fn<Promise<number | null>, [number, number]>(() => Promise.resolve(1290.5));
        guardarAltitudDeServicio = jest.fn<Promise<boolean>, [string, number]>((_id, metros) => {
            altitudGuardada = { metros };
            return Promise.resolve(true);
        });
        registrar = jest.fn<Promise<void>, [RegistroConsultaUbicacion]>(() => Promise.resolve());
        armar();
    });

    describe("acceso", () => {
        it("el administrador accede a cualquier solicitud", async () => {
            const ubicacion = await servicio.ejecutar(ADMIN, solicitud.id);

            expect(ubicacion).toMatchObject({ solicitudId: solicitud.id, latitud: 1.85, longitud: -76.05 });
        });

        it("el agrónomo asignado accede", async () => {
            await expect(servicio.ejecutar(ASIGNADO, solicitud.id)).resolves.not.toBeNull();
        });

        it("un agrónomo no asignado no accede ni se entera de que existe (404, como el detalle)", async () => {
            await expect(servicio.ejecutar(AJENO, solicitud.id)).rejects.toThrow(NotFoundException);

            expect(elevacion).not.toHaveBeenCalled();
            expect(registrar).not.toHaveBeenCalled();
        });

        it("un productor no accede", async () => {
            await expect(servicio.ejecutar({ id: "u-1", rol: "productor" }, solicitud.id)).rejects.toThrow();
        });
    });

    describe("consentimiento", () => {
        it("con el consentimiento revocado responde 404 sin exponer coordenadas ni consultar elevación", async () => {
            consentimiento = false;

            const error = await servicio.ejecutar(ADMIN, solicitud.id).catch((e: unknown) => e);

            expect(error).toBeInstanceOf(NotFoundException);
            expect(JSON.stringify((error as NotFoundException).getResponse())).not.toMatch(/1\.85|76\.05/);
            expect(elevacion).not.toHaveBeenCalled();
            expect(registrar).not.toHaveBeenCalled();
        });

        it("el KML tampoco sale con el consentimiento revocado", async () => {
            consentimiento = false;

            await expect(servicio.ejecutarKml(ADMIN, solicitud.id)).rejects.toThrow(NotFoundException);
        });
    });

    describe("solicitud sin ubicación", () => {
        beforeEach(() => {
            solicitud = crearSolicitud({ latitud: null });
            armar();
        });

        it("devuelve null y no consulta elevación", async () => {
            await expect(servicio.ejecutar(ADMIN, solicitud.id)).resolves.toBeNull();

            expect(elevacion).not.toHaveBeenCalled();
        });

        it("el KML responde 404", async () => {
            await expect(servicio.ejecutarKml(ADMIN, solicitud.id)).rejects.toThrow(NotFoundException);
        });
    });

    describe("altitud perezosa", () => {
        it("sin altitud consulta la elevación una vez, la guarda con origen servicio y la devuelve", async () => {
            const ubicacion = await servicio.ejecutar(ADMIN, solicitud.id);

            expect(elevacion).toHaveBeenCalledTimes(1);
            expect(elevacion).toHaveBeenCalledWith(1.85, -76.05);
            expect(guardarAltitudDeServicio).toHaveBeenCalledWith(solicitud.id, 1290.5);
            expect(ubicacion).toMatchObject({ altitudMsnm: 1290.5, altitudOrigen: "servicio" });
        });

        it("las consultas siguientes reutilizan la altitud guardada y no vuelven a llamar al servicio", async () => {
            await servicio.ejecutar(ADMIN, solicitud.id);
            const segunda = await servicio.ejecutar(ADMIN, solicitud.id);
            await servicio.ejecutar(ASIGNADO, solicitud.id);

            expect(elevacion).toHaveBeenCalledTimes(1);
            expect(guardarAltitudDeServicio).toHaveBeenCalledTimes(1);
            expect(segunda).toMatchObject({ altitudMsnm: 1290.5 });
        });

        it("si el celular mandó altitud del GPS no consulta nada y conserva su origen", async () => {
            solicitud = crearSolicitud({ altitud: 1200 });
            armar();

            const ubicacion = await servicio.ejecutar(ADMIN, solicitud.id);

            expect(elevacion).not.toHaveBeenCalled();
            expect(ubicacion).toMatchObject({ altitudMsnm: 1200, altitudOrigen: "gps" });
        });

        it("si el servicio de elevación falla deja la altitud en null y la consulta sigue funcionando", async () => {
            elevacion.mockResolvedValue(null);

            const ubicacion = await servicio.ejecutar(ADMIN, solicitud.id);

            expect(ubicacion).toMatchObject({ altitudMsnm: null, altitudOrigen: null, latitud: 1.85 });
            expect(guardarAltitudDeServicio).not.toHaveBeenCalled();
        });

        it("si el adaptador incumple el contrato y lanza, tampoco rompe la consulta", async () => {
            elevacion.mockRejectedValue(new Error("boom"));

            await expect(servicio.ejecutar(ADMIN, solicitud.id)).resolves.toMatchObject({ altitudMsnm: null });
        });

        it("un fallo del servicio no se guarda: la próxima consulta lo vuelve a intentar", async () => {
            elevacion.mockResolvedValueOnce(null).mockResolvedValueOnce(1300);

            await servicio.ejecutar(ADMIN, solicitud.id);
            const segunda = await servicio.ejecutar(ADMIN, solicitud.id);

            expect(elevacion).toHaveBeenCalledTimes(2);
            expect(segunda).toMatchObject({ altitudMsnm: 1300 });
        });
    });

    describe("auditoría", () => {
        it("registra quién consultó el detalle y qué solicitud", async () => {
            await servicio.ejecutar(ASIGNADO, solicitud.id);

            expect(registrar).toHaveBeenCalledTimes(1);
            expect(registrar).toHaveBeenCalledWith({
                accion: "ubicacion_detalle",
                actorUsuarioId: "u-a-1",
                solicitudId: solicitud.id,
                filtros: null,
                resultados: null,
            });
        });

        it("registra el KML como otra acción", async () => {
            await servicio.ejecutarKml(ADMIN, solicitud.id);

            expect(registrar).toHaveBeenCalledWith(
                expect.objectContaining({
                    accion: "ubicacion_kml",
                    actorUsuarioId: "u-admin",
                    solicitudId: solicitud.id,
                }),
            );
        });

        it("si el rastro no se puede escribir, la consulta falla y no entrega coordenadas", async () => {
            registrar.mockRejectedValue(new Error("base caída"));

            await expect(servicio.ejecutar(ADMIN, solicitud.id)).rejects.toThrow("base caída");
        });
    });

    describe("KML", () => {
        it("pone longitud,latitud,altitud y escapa el nombre del productor", async () => {
            const { nombreArchivo, kml } = await servicio.ejecutarKml(ADMIN, solicitud.id);

            expect(nombreArchivo).toBe("sol-11111111.kml");
            expect(kml).toContain("<coordinates>-76.05,1.85,1290.5</coordinates>");
            expect(kml).toContain("<altitudeMode>absolute</altitudeMode>");
            expect(kml).toContain("Productor: Ana &amp; Muñoz");
            expect(kml).not.toContain("Ana & Muñoz");
        });
    });

    describe("detalle del panel", () => {
        it("no trae coordenadas y avisa que hay ubicación", async () => {
            const detalle = new ObtenerSolicitudPorIdService(
                lectura,
                new VerificarAccesoSolicitudService(lectura, agronomos),
            );

            const vista = await detalle.ejecutar(ADMIN, solicitud.id);

            expect(vista).toMatchObject({ latitud: null, longitud: null, precisionMetros: null, altitudMsnm: null });
            expect(vista).toHaveProperty("tieneUbicacion", true);
            expect(JSON.stringify(vista)).not.toMatch(/1\.85|-76\.05/);
        });
    });
});
