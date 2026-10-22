import { ForbiddenException } from "@nestjs/common";
import { ContarSolicitudesService } from "./contar-solicitudes.service";
import { armarContadores, type ConteoBandeja } from "../../domain/services/contadores-bandeja";
import type { ILecturaSolicitudes } from "../../domain/ports/out/lectura-solicitudes.port";
import type { IAgronomoRepository } from "../../../agronomos/domain/ports/out/agronomo.repository";

const ADMIN = { id: "u-admin", rol: "admin" };
const AGRONOMO = { id: "u-a-1", rol: "agronomo" };

describe("Contadores de la bandeja (RF-03.4, RF-08.2)", () => {
    describe("armarContadores", () => {
        it("sin solicitudes trae todos los estados en 0", () => {
            expect(armarContadores({ porEstado: [], sinAsignar: 0 })).toEqual({
                total: 0,
                porEstado: { Pendiente: 0, Enviada: 0, Asignada: 0, Resuelta: 0, Descartada: 0 },
                sinAsignar: 0,
            });
        });

        it("completa los estados que faltan y suma el total", () => {
            const contadores = armarContadores({
                porEstado: [
                    { estado: "Enviada", casos: 7 },
                    { estado: "Resuelta", casos: 12 },
                ],
                sinAsignar: 4,
            });

            expect(contadores).toEqual({
                total: 19,
                porEstado: { Pendiente: 0, Enviada: 7, Asignada: 0, Resuelta: 12, Descartada: 0 },
                sinAsignar: 4,
            });
        });
    });

    describe("ContarSolicitudesService", () => {
        let contarBandeja: jest.Mock<Promise<ConteoBandeja>, [{ agronomoId?: string }]>;
        let agronomoId: string | null;
        let servicio: ContarSolicitudesService;

        beforeEach(() => {
            agronomoId = "a-1";
            contarBandeja = jest.fn<Promise<ConteoBandeja>, [{ agronomoId?: string }]>(() =>
                Promise.resolve({
                    porEstado: [
                        { estado: "Enviada", casos: 3 },
                        { estado: "Asignada", casos: 2 },
                    ],
                    sinAsignar: 3,
                }),
            );
            const lectura = { contarBandeja } as unknown as ILecturaSolicitudes;
            const agronomos = {
                findByUsuarioId: () => Promise.resolve(agronomoId ? { id: agronomoId } : null),
            } as unknown as IAgronomoRepository;
            servicio = new ContarSolicitudesService(lectura, agronomos);
        });

        it("el administrador cuenta todas en una sola consulta, con las sin asignar", async () => {
            const contadores = await servicio.ejecutar(ADMIN);

            expect(contarBandeja).toHaveBeenCalledTimes(1);
            expect(contarBandeja).toHaveBeenCalledWith({});
            expect(contadores.total).toBe(5);
            expect(contadores.sinAsignar).toBe(3);
        });

        it("el agrónomo cuenta únicamente lo suyo y su sinAsignar es 0", async () => {
            const contadores = await servicio.ejecutar(AGRONOMO);

            expect(contarBandeja).toHaveBeenCalledWith({ agronomoId: "a-1" });
            expect(contadores.sinAsignar).toBe(0);
            expect(Object.keys(contadores.porEstado)).toEqual([
                "Pendiente",
                "Enviada",
                "Asignada",
                "Resuelta",
                "Descartada",
            ]);
        });

        it("un agrónomo sin perfil recibe 403 y no se cuenta nada", async () => {
            agronomoId = null;

            await expect(servicio.ejecutar(AGRONOMO)).rejects.toBeInstanceOf(ForbiddenException);
            expect(contarBandeja).not.toHaveBeenCalled();
        });

        it("otro rol recibe 403", async () => {
            await expect(servicio.ejecutar({ id: "u-p", rol: "productor" })).rejects.toBeInstanceOf(ForbiddenException);
        });
    });
});
