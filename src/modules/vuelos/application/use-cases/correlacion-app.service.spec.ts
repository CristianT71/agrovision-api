import { CorrelacionAppService } from "./correlacion-app.service";
import type { IVuelosRepository } from "../../domain/ports/out/vuelos.repository";
import { VueloNoEncontradoError } from "../../domain/errors/vuelos.error";

describe("CorrelacionAppService", () => {
    const vuelos = { obtener: jest.fn(), resumen: jest.fn() };
    const lectura = { consultar: jest.fn(), reglasZona: jest.fn() };
    const servicio = new CorrelacionAppService(vuelos as unknown as IVuelosRepository, lectura);
    const caja = { sur: 4, norte: 4.01, oeste: -74, este: -73.99 };
    const resumen = {
        total: 0,
        porOrigen: { deteccion: 0, solicitud: 0 },
        porClase: [],
        fechaMin: null,
        fechaMax: null,
    };
    beforeEach(() => {
        jest.resetAllMocks();
        vuelos.obtener.mockResolvedValue({ id: "v" });
        vuelos.resumen.mockResolvedValue({ v: { caja, primeraCapturaEn: "2026-01-10T12:00:00Z" } });
        lectura.consultar.mockResolvedValue({ registros: [], resumen });
        lectura.reglasZona.mockResolvedValue([]);
    });
    it("entrega las reglas de zona con su estado; si fallan, lo avisa sin romper", async () => {
        const regla = {
            tipo: "roya",
            version: 2,
            estado: "borrador",
            calibrada: false,
            fuente: "https://x",
            cortesIncidenciaPct: [5, 15, 100],
        };
        lectura.reglasZona.mockResolvedValue([regla]);
        expect((await servicio.ejecutar("v")).reglasZona).toEqual([regla]);
        lectura.reglasZona.mockRejectedValue(new Error("x"));
        const r = await servicio.ejecutar("v");
        expect(r.reglasZona).toEqual([]);
        expect(r.limitaciones).toContain("No se pudieron leer las reglas de zona.");
    });
    it("reutiliza la caja del detalle y amplía 300 metros por defecto", async () => {
        const r = await servicio.ejecutar("v");
        expect(vuelos.resumen).toHaveBeenCalledWith(["v"]);
        expect(r.radioM).toBe(300);
        expect(r.caja).toEqual(caja);
        expect(r.cajaAmpliada!.sur).toBeCloseTo(4 - 300 / 110574, 8);
        expect(r.cajaAmpliada!.este).toBeGreaterThan(caja.este);
        expect(lectura.consultar).toHaveBeenCalledWith(r.cajaAmpliada);
        expect(r.truncado).toBe(false);
    });
    it("conserva el signo y fracciones de los días; confianza y clase desconocidas son null", async () => {
        lectura.consultar.mockResolvedValue({
            resumen,
            registros: ["2026-01-10T00:00:00Z", "2026-01-11T12:00:00Z", null].map((fecha) => ({
                origen: "deteccion",
                clase: null,
                confianza: null,
                fecha,
                latitud: 4,
                longitud: -74,
            })),
        });
        const r = await servicio.ejecutar("v", 0);
        expect(r.cajaAmpliada).toEqual(caja);
        expect(r.registros.map((r) => r.diasDesdeVuelo)).toEqual([-0.5, 1, null]);
        expect(r.registros[0].confianza).toBeNull();
        expect(r.registros[0].clase).toBeNull();
    });
    it("no sustituye la fecha de captura desconocida con la fecha de creación", async () => {
        vuelos.resumen.mockResolvedValue({ v: { caja, primeraCapturaEn: null } });
        lectura.consultar.mockResolvedValue({
            resumen,
            registros: [
                {
                    origen: "solicitud",
                    clase: null,
                    confianza: null,
                    fecha: "2026-01-01T00:00:00Z",
                    latitud: 4,
                    longitud: -74,
                },
            ],
        });
        const r = await servicio.ejecutar("v");
        expect(r.fechaVuelo).toBeNull();
        expect(r.registros[0].diasDesdeVuelo).toBeNull();
    });
    it.each([null, { sur: null, norte: 4, oeste: -74, este: -73 }, { sur: 91, norte: 92, oeste: 0, este: 1 }])(
        "sin caja válida no consulta ubicaciones: %s",
        async (caja) => {
            vuelos.resumen.mockResolvedValue({ v: { caja } });
            const r = await servicio.ejecutar("v");
            expect(r.caja).toBeNull();
            expect(r.registros).toEqual([]);
            expect(r.resumen.fechaMin).toBeNull();
            expect(lectura.consultar).not.toHaveBeenCalled();
        },
    );
    it("404 para vuelo inexistente", async () => {
        vuelos.obtener.mockResolvedValue(null);
        await expect(servicio.ejecutar("v")).rejects.toBeInstanceOf(VueloNoEncontradoError);
        expect(lectura.consultar).not.toHaveBeenCalled();
    });
    it.each([-1, 2001, 0.5, NaN, Infinity])("rechaza radio %s", async (radio) => {
        await expect(servicio.ejecutar("v", radio)).rejects.toThrow("radioM");
        expect(vuelos.obtener).not.toHaveBeenCalled();
    });
    it.each([500, 501])("limita resultados y mantiene resumen global de %s coincidencias", async (total) => {
        lectura.consultar.mockResolvedValue({
            registros: Array.from({ length: 500 }, () => ({
                origen: "deteccion",
                clase: null,
                confianza: null,
                fecha: null,
                latitud: 4,
                longitud: -74,
            })),
            resumen: { ...resumen, total },
        });
        const r = await servicio.ejecutar("v", 2000);
        expect(r.registros).toHaveLength(500);
        expect(r.truncado).toBe(total > 500);
        expect(r.resumen.total).toBe(total);
    });
    it("permite consultar el otro lado del antimeridiano y limita los polos", async () => {
        vuelos.resumen.mockResolvedValue({ v: { caja: { sur: 89.99, norte: 90, oeste: 179.99, este: 180 } } });
        const r = await servicio.ejecutar("v", 2000);
        expect(r.cajaAmpliada!.norte).toBe(90);
        expect(r.cajaAmpliada!.este).toBe(360);
    });
});
