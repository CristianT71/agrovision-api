import { NotFoundException } from "@nestjs/common";
import { CasosSimilaresService } from "./casos-similares.service";
import { Solicitud, type Cultivo, type Organo } from "../../domain/entities/solicitud.entity";
import { calcularSimilitud, distanciaKm } from "../../domain/services/similitud-casos";
import type { ILecturaSolicitudes, SolicitudConProductor } from "../../domain/ports/out/lectura-solicitudes.port";
import { VerificarAccesoSolicitudService } from "./verificar-acceso-solicitud.service";
import type { IAgronomoRepository } from "../../../agronomos/domain/ports/out/agronomo.repository";

const ADMIN = { id: "u-admin", rol: "admin" };
const AGRONOMO = { id: "u-a-1", rol: "agronomo" };

type Datos = {
    id: string;
    municipio?: string;
    vereda?: string;
    organo?: Organo | null;
    cultivo?: Cultivo | null;
    coordenadas?: [number, number] | null;
    diasAtras?: number;
    plaga?: string | null;
};

const crear = ({
    id,
    municipio = "Pitalito",
    vereda = "El Cedro",
    organo = "HOJA",
    cultivo = "CAFE",
    coordenadas = null,
    diasAtras = 0,
    plaga = null,
}: Datos) =>
    new Solicitud(
        id,
        "p-1",
        "a-1",
        plaga ? "Resuelta" : "Enviada",
        new Date(Date.now() - diasAtras * 24 * 60 * 60 * 1000),
        municipio,
        vereda,
        "La Esperanza",
        null,
        null,
        plaga ? "Respuesta" : null,
        plaga ? "Confirma diagnóstico IA" : null,
        plaga,
        plaga ? new Date() : null,
        null,
        null,
        cultivo,
        organo,
        null,
        coordenadas?.[0] ?? null,
        coordenadas?.[1] ?? null,
    );

describe("Similitud de casos (RF-04.3)", () => {
    it("dos casos iguales, del mismo lugar y el mismo día, son 100 % similares", () => {
        expect(calcularSimilitud(crear({ id: "a" }), crear({ id: "b", plaga: "Roya" }))).toBe(100);
    });

    it("pesa más el órgano afectado que la ubicación", () => {
        const base = crear({ id: "base" });
        // Mismo órgano en otro municipio: 35 + 20 + 0 + 15 = 70
        const mismoOrgano = crear({ id: "o", municipio: "Garzón" });
        // Mismo lugar con otro órgano: 0 + 20 + 30 + 15 = 65
        const mismoLugar = crear({ id: "l", organo: "FRUTO" });

        expect(calcularSimilitud(base, mismoOrgano)).toBe(70);
        expect(calcularSimilitud(base, mismoLugar)).toBe(65);
    });

    it("con coordenadas usa la distancia: una finca a 10 km se parece más que una a 40 km", () => {
        const base = crear({ id: "base", coordenadas: [1.853, -76.051] });
        const cerca = crear({ id: "c", coordenadas: [1.943, -76.051] });
        const lejos = crear({ id: "l", coordenadas: [2.213, -76.051] });

        expect(distanciaKm({ latitud: 1.853, longitud: -76.051 }, { latitud: 1.943, longitud: -76.051 })).toBeCloseTo(
            10,
            0,
        );
        expect(calcularSimilitud(base, cerca)).toBeGreaterThan(calcularSimilitud(base, lejos));
    });

    it("un caso de hace más de un año no suma por recencia", () => {
        const base = crear({ id: "base" });
        expect(calcularSimilitud(base, crear({ id: "v", diasAtras: 400 }))).toBe(85);
    });
});

describe("CasosSimilaresService", () => {
    let base: SolicitudConProductor | null;
    let resueltas: SolicitudConProductor[];
    let servicio: CasosSimilaresService;

    beforeEach(() => {
        base = { solicitud: crear({ id: "base" }), productorNombre: "Carlos" };
        resueltas = [
            {
                solicitud: crear({ id: "lejos", municipio: "Garzón", organo: "FRUTO", plaga: "Broca" }),
                productorNombre: "Ana",
            },
            { solicitud: crear({ id: "igual", plaga: "Roya" }), productorNombre: "Luz" },
            { solicitud: crear({ id: "medio", organo: "FRUTO", plaga: "Phoma" }), productorNombre: "José" },
            { solicitud: crear({ id: "otro", cultivo: "CACAO", plaga: "Monilia" }), productorNombre: "Rodrigo" },
        ];

        const lectura = {
            obtener: () => Promise.resolve(base),
            listarResueltas: () => Promise.resolve(resueltas),
        } as unknown as ILecturaSolicitudes;
        // El caso base está asignado a "a-1", que es el agrónomo de la cuenta "u-a-1"
        const agronomos = {
            findByUsuarioId: () => Promise.resolve({ id: "a-1" }),
        } as unknown as IAgronomoRepository;
        servicio = new CasosSimilaresService(lectura, new VerificarAccesoSolicitudService(lectura, agronomos));
    });

    it("devuelve los 3 casos resueltos más parecidos, de mayor a menor", async () => {
        const similares = await servicio.ejecutar(ADMIN, "base");

        expect(similares.map((c) => c.id)).toEqual(["igual", "otro", "medio"]);
        expect(similares[0]).toMatchObject({ plagaIdentificada: "Roya", productorNombre: "Luz", similitud: 100 });
    });

    it("respeta el límite pedido", async () => {
        expect(await servicio.ejecutar(ADMIN, "base", 1)).toHaveLength(1);
    });

    it("responde 404 si la solicitud no existe", async () => {
        base = null;

        await expect(servicio.ejecutar(ADMIN, "x")).rejects.toBeInstanceOf(NotFoundException);
    });

    it("al administrador le entrega el productor y la ubicación de cada expediente", async () => {
        const [caso] = await servicio.ejecutar(ADMIN, "base");

        expect(caso).toMatchObject({
            productorNombre: "Luz",
            municipio: "Pitalito",
            vereda: "El Cedro",
            finca: "La Esperanza",
        });
    });

    it("al agrónomo no le entrega datos del productor de otros expedientes", async () => {
        const similares = await servicio.ejecutar(AGRONOMO, "base");

        expect(similares.map((c) => c.id)).toEqual(["igual", "otro", "medio"]);
        for (const caso of similares) {
            expect(Object.keys(caso).sort()).toEqual(
                ["fechaResolucion", "id", "plagaIdentificada", "similitud", "tipoResultado"].sort(),
            );
        }
    });
});
