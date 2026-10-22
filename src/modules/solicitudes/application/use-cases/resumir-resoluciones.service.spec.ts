import { ForbiddenException } from "@nestjs/common";
import { ResumirResolucionesService } from "./resumir-resoluciones.service";
import { Solicitud } from "../../domain/entities/solicitud.entity";
import { agruparPorDia, completarPorTipo, diaEnColombia } from "../../domain/services/resoluciones";
import type { ILecturaSolicitudes, SolicitudConProductor } from "../../domain/ports/out/lectura-solicitudes.port";
import type { VentanaTiempo } from "../../../../common/utils/ventana-tiempo";
import { ReglaNegocioError } from "../../../../common/errors/regla-negocio.error";

const ADMIN = { id: "u-admin", rol: "admin" };
const DIA = 24 * 60 * 60 * 1000;
const AHORA = new Date("2026-10-05T15:00:00Z");

const plagaNueva = (id: string, fechaResolucion: Date): SolicitudConProductor => ({
    solicitud: new Solicitud(
        id,
        "p-1",
        "a-1",
        "Resuelta",
        new Date("2026-10-01T12:00:00Z"),
        "Pitalito",
        "El Cedro",
        "La Esperanza",
        null,
        null,
        "Plaga sin registro en el catálogo, se envía muestra al laboratorio.",
        "Plaga nueva",
        "Ácaro desconocido",
        fechaResolucion,
    ),
    productorNombre: "Ana Muñoz",
});

describe("Tablero de resoluciones (RF-06.5 a RF-06.7)", () => {
    describe("reglas de dominio", () => {
        it("una resolución a las 9 p. m. del 4 (hora de Colombia) cae el día 4", () => {
            // 9 p. m. del 4 en Colombia son las 2 a. m. del 5 en UTC
            expect(diaEnColombia(new Date("2026-10-05T02:00:00Z"))).toBe("2026-10-04");
            // Y la medianoche de Colombia ya es el día siguiente
            expect(diaEnColombia(new Date("2026-10-05T05:00:00Z"))).toBe("2026-10-05");
        });

        it("agrupa por día en orden cronológico y solo con los días que tienen casos", () => {
            const serie = agruparPorDia([
                new Date("2026-10-05T02:00:00Z"),
                new Date("2026-10-01T15:00:00Z"),
                new Date("2026-10-04T13:00:00Z"),
            ]);

            expect(serie).toEqual([
                { dia: "2026-10-01", casos: 1 },
                { dia: "2026-10-04", casos: 2 },
            ]);
        });

        it("trae todos los tipos de resultado, con 0 si no hay", () => {
            expect(completarPorTipo([{ tipo: "Planta sana", casos: 3 }])).toEqual([
                { tipo: "Confirma diagnóstico IA", casos: 0 },
                { tipo: "Corrige diagnóstico IA", casos: 0 },
                { tipo: "Plaga nueva", casos: 0 },
                { tipo: "Imagen no diagnosticable", casos: 0 },
                { tipo: "Planta sana", casos: 3 },
            ]);
        });
    });

    describe("ResumirResolucionesService", () => {
        let lectura: ILecturaSolicitudes;
        let contarResueltasPorTipo: jest.Mock<Promise<{ tipo: string | null; casos: number }[]>, [VentanaTiempo]>;
        let contarPlagaNuevaDesde: jest.Mock<Promise<number>, [Date]>;
        let servicio: ResumirResolucionesService;

        beforeEach(() => {
            jest.useFakeTimers({ now: AHORA });

            contarResueltasPorTipo = jest.fn<Promise<{ tipo: string | null; casos: number }[]>, [VentanaTiempo]>(() =>
                Promise.resolve([
                    { tipo: "Confirma diagnóstico IA", casos: 8 },
                    { tipo: "Plaga nueva", casos: 3 },
                ]),
            );
            contarPlagaNuevaDesde = jest.fn<Promise<number>, [Date]>(() => Promise.resolve(5));
            lectura = {
                contarResueltasPorTipo,
                fechasPlagaNueva: () =>
                    Promise.resolve([
                        new Date("2026-10-05T02:00:00Z"),
                        new Date("2026-10-04T13:00:00Z"),
                        new Date("2026-10-02T16:00:00Z"),
                    ]),
                listarPlagaNueva: () => Promise.resolve([plagaNueva("s-9", new Date("2026-10-05T02:00:00Z"))]),
                contarPlagaNuevaDesde,
            } as unknown as ILecturaSolicitudes;
            servicio = new ResumirResolucionesService(lectura);
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it("por defecto mira los últimos 30 días hasta ahora", async () => {
            const resumen = await servicio.ejecutar(ADMIN, {});

            expect(resumen.hasta).toEqual(AHORA);
            expect(AHORA.getTime() - resumen.desde.getTime()).toBe(30 * DIA);
            expect(contarResueltasPorTipo).toHaveBeenCalledWith({ desde: resumen.desde, hasta: resumen.hasta });
        });

        it("rechaza una ventana de más de 90 días sin consultar la base", async () => {
            await expect(
                servicio.ejecutar(ADMIN, { desde: new Date(AHORA.getTime() - 91 * DIA), hasta: AHORA }),
            ).rejects.toBeInstanceOf(ReglaNegocioError);
            expect(contarResueltasPorTipo).not.toHaveBeenCalled();
        });

        it("suma el total de resueltas y trae los tipos que no tienen casos en 0", async () => {
            const resumen = await servicio.ejecutar(ADMIN, {});

            expect(resumen.total).toBe(11);
            expect(resumen.porTipo).toHaveLength(5);
            expect(resumen.porTipo).toContainEqual({ tipo: "Planta sana", casos: 0 });
            expect(resumen.porTipo).toContainEqual({ tipo: "Plaga nueva", casos: 3 });
        });

        it("cuenta la última semana desde ahora y activa la alerta en el umbral", async () => {
            const { plagasNuevas } = await servicio.ejecutar(ADMIN, {});

            expect(contarPlagaNuevaDesde).toHaveBeenCalledWith(new Date(AHORA.getTime() - 7 * DIA));
            expect(plagasNuevas).toMatchObject({ umbral: 5, casosUltimaSemana: 5, alertaActiva: true });
        });

        it("con 4 casos en la semana la alerta no está activa", async () => {
            contarPlagaNuevaDesde.mockResolvedValue(4);

            const { plagasNuevas } = await servicio.ejecutar(ADMIN, {});

            expect(plagasNuevas.alertaActiva).toBe(false);
        });

        it("arma la serie por día en hora de Colombia", async () => {
            const { plagasNuevas } = await servicio.ejecutar(ADMIN, {});

            expect(plagasNuevas.serie).toEqual([
                { dia: "2026-10-02", casos: 1 },
                { dia: "2026-10-04", casos: 2 },
            ]);
        });

        it("cada caso trae lo que el administrador necesita para revisarlo", async () => {
            const { plagasNuevas } = await servicio.ejecutar(ADMIN, {});

            expect(plagasNuevas.casos).toEqual([
                {
                    id: "s-9",
                    plagaIdentificada: "Ácaro desconocido",
                    fechaResolucion: new Date("2026-10-05T02:00:00Z"),
                    productorNombre: "Ana Muñoz",
                    finca: "La Esperanza",
                    vereda: "El Cedro",
                    municipio: "Pitalito",
                    respuestaProfesional: "Plaga sin registro en el catálogo, se envía muestra al laboratorio.",
                },
            ]);
        });

        it("un agrónomo recibe 403 y no se consulta nada", async () => {
            await expect(servicio.ejecutar({ id: "u-a-1", rol: "agronomo" }, {})).rejects.toBeInstanceOf(
                ForbiddenException,
            );
            expect(contarResueltasPorTipo).not.toHaveBeenCalled();
        });
    });
});
