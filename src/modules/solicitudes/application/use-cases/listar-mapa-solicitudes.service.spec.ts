import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { ListarMapaSolicitudesService } from "./listar-mapa-solicitudes.service";
import { MAX_PUNTOS_MAPA, type FiltrosMapa, type PuntoMapa } from "../../domain/ports/in/ubicacion-solicitudes.port";
import type { ILecturaSolicitudes } from "../../domain/ports/out/lectura-solicitudes.port";
import type { RegistroConsultaUbicacion } from "../../domain/ports/out/auditoria-ubicaciones.port";

const ADMIN = { id: "u-admin", rol: "admin" };

const punto = (indice: number, cambios: Partial<PuntoMapa> = {}): PuntoMapa => ({
    solicitudId: `${String(indice).padStart(8, "0")}-1111-4111-8111-111111111111`,
    estado: "Enviada",
    fecha: new Date("2026-05-01T10:00:00Z"),
    productorNombre: "Ana",
    municipio: "Pitalito",
    vereda: "El Cedro",
    finca: "La Esperanza",
    cultivo: "CAFE",
    latitud: 1.85,
    longitud: -76.05,
    altitudMsnm: 1290,
    simulada: false,
    ...cambios,
});

describe("ListarMapaSolicitudesService", () => {
    let listarMapa: jest.Mock<Promise<PuntoMapa[]>, [FiltrosMapa, number]>;
    let registrar: jest.Mock<Promise<void>, [RegistroConsultaUbicacion]>;
    let servicio: ListarMapaSolicitudesService;

    beforeEach(() => {
        listarMapa = jest.fn<Promise<PuntoMapa[]>, [FiltrosMapa, number]>(() => Promise.resolve([punto(1), punto(2)]));
        registrar = jest.fn<Promise<void>, [RegistroConsultaUbicacion]>(() => Promise.resolve());
        servicio = new ListarMapaSolicitudesService({ listarMapa } as unknown as ILecturaSolicitudes, { registrar });
    });

    it("solo el administrador ve el mapa", async () => {
        await expect(servicio.ejecutar({ id: "u-a-1", rol: "agronomo" }, {})).rejects.toThrow(ForbiddenException);
        await expect(servicio.ejecutar({ id: "u-1", rol: "productor" }, {})).rejects.toThrow(ForbiddenException);

        expect(listarMapa).not.toHaveBeenCalled();
        expect(registrar).not.toHaveBeenCalled();
    });

    it("devuelve los puntos y pasa los filtros a la consulta", async () => {
        const filtros: FiltrosMapa = { estado: "Enviada", cultivo: "CAFE", municipio: "Pitalito" };

        const mapa = await servicio.ejecutar(ADMIN, filtros);

        expect(mapa.puntos).toHaveLength(2);
        expect(mapa.truncado).toBe(false);
        expect(listarMapa).toHaveBeenCalledWith(filtros, MAX_PUNTOS_MAPA + 1);
    });

    describe("límite duro de 500 puntos", () => {
        it("con exactamente 500 no marca truncado", async () => {
            listarMapa.mockResolvedValue(Array.from({ length: 500 }, (_, i) => punto(i)));

            const mapa = await servicio.ejecutar(ADMIN, {});

            expect(mapa.puntos).toHaveLength(500);
            expect(mapa.truncado).toBe(false);
        });

        it("con más de 500 recorta a 500 y avisa que hubo más", async () => {
            listarMapa.mockResolvedValue(Array.from({ length: 501 }, (_, i) => punto(i)));

            const mapa = await servicio.ejecutar(ADMIN, {});

            expect(mapa.puntos).toHaveLength(MAX_PUNTOS_MAPA);
            expect(mapa.truncado).toBe(true);
            expect(mapa.limite).toBe(500);
        });

        it("el KML también respeta el límite", async () => {
            listarMapa.mockResolvedValue(Array.from({ length: 501 }, (_, i) => punto(i)));

            const { kml } = await servicio.ejecutarKml(ADMIN, {});

            expect(kml.match(/<Placemark>/g)).toHaveLength(500);
        });
    });

    it("rechaza un rango de fechas invertido sin consultar", async () => {
        const filtros = { desde: new Date("2026-06-01"), hasta: new Date("2026-05-01") };

        await expect(servicio.ejecutar(ADMIN, filtros)).rejects.toThrow(BadRequestException);
        expect(listarMapa).not.toHaveBeenCalled();
    });

    describe("auditoría", () => {
        it("registra una sola entrada por consulta con los filtros y cuántos puntos devolvió", async () => {
            await servicio.ejecutar(ADMIN, { estado: "Enviada", desde: new Date("2026-05-01T00:00:00Z") });

            expect(registrar).toHaveBeenCalledTimes(1);
            expect(registrar).toHaveBeenCalledWith({
                accion: "mapa_listado",
                actorUsuarioId: "u-admin",
                solicitudId: null,
                filtros: { estado: "Enviada", desde: "2026-05-01T00:00:00.000Z" },
                resultados: 2,
            });
        });

        it("el KML del mapa registra una entrada como mapa_kml", async () => {
            await servicio.ejecutarKml(ADMIN, {});

            expect(registrar).toHaveBeenCalledTimes(1);
            expect(registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: "mapa_kml", resultados: 2 }));
        });

        it("si el rastro falla no entrega el mapa", async () => {
            registrar.mockRejectedValue(new Error("base caída"));

            await expect(servicio.ejecutar(ADMIN, {})).rejects.toThrow("base caída");
        });
    });

    it("el KML escapa los nombres y usa el orden longitud,latitud,altitud", async () => {
        listarMapa.mockResolvedValue([punto(1, { productorNombre: "Pérez & Hijos <SAS>", altitudMsnm: 1500.25 })]);

        const { nombreArchivo, kml } = await servicio.ejecutarKml(ADMIN, {});

        expect(nombreArchivo).toBe("mapa-solicitudes.kml");
        expect(kml).toContain("Pérez &amp; Hijos &lt;SAS&gt;");
        expect(kml).toContain("<coordinates>-76.05,1.85,1500.25</coordinates>");
    });
});
