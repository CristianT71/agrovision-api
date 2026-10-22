import type { Repository } from "typeorm";
import { TypeOrmLecturaSolicitudesAdapter } from "./typeorm-lectura-solicitudes.adapter";
import type { TypeOrmSolicitudEntity } from "./typeorm-solicitud.entity";
import type { TypeOrmAnexoResolucionEntity } from "./typeorm-anexo-resolucion.entity";

// @nestjs/typeorm se publica como ESM y Jest no lo carga: aquí solo hace falta que el decorador exista
jest.mock("@nestjs/typeorm", () => ({ InjectRepository: () => () => undefined }));

type Llamada = [metodo: string, ...args: unknown[]];

const ENCADENABLES = [
    "leftJoinAndSelect",
    "select",
    "addSelect",
    "where",
    "andWhere",
    "orderBy",
    "addOrderBy",
    "groupBy",
    "offset",
    "limit",
    "take",
];

// Query builder de mentira: registra cada llamada y devuelve los resultados configurados
function crearConsulta(resultado: { raw?: unknown[]; manyAndCount?: [unknown[], number] } = {}) {
    const llamadas: Llamada[] = [];
    const consulta: Record<string, unknown> = {
        getRawMany: () => Promise.resolve(resultado.raw ?? []),
        getManyAndCount: () => Promise.resolve(resultado.manyAndCount ?? [[], 0]),
    };
    for (const metodo of ENCADENABLES) {
        consulta[metodo] = (...args: unknown[]) => {
            llamadas.push([metodo, ...args]);
            return consulta;
        };
    }
    return { consulta, llamadas };
}

describe("TypeOrmLecturaSolicitudesAdapter (consultas)", () => {
    let consultas: ReturnType<typeof crearConsulta>[];
    let siguiente: { raw?: unknown[]; manyAndCount?: [unknown[], number] };
    let adaptador: TypeOrmLecturaSolicitudesAdapter;

    beforeEach(() => {
        consultas = [];
        siguiente = {};
        const repository = {
            createQueryBuilder: () => {
                const nueva = crearConsulta(siguiente);
                consultas.push(nueva);
                return nueva.consulta;
            },
        } as unknown as Repository<TypeOrmSolicitudEntity>;
        adaptador = new TypeOrmLecturaSolicitudesAdapter(repository, {} as Repository<TypeOrmAnexoResolucionEntity>);
    });

    const llamadasDe = (metodo: string) => consultas[0].llamadas.filter(([m]) => m === metodo);

    describe("listarPagina", () => {
        it("ordena por fecha DESC con el id como desempate, para que la paginación sea estable", async () => {
            await adaptador.listarPagina({}, { numero: 1, limite: 20 });

            expect(llamadasDe("orderBy")).toEqual([["orderBy", "s.fecha", "DESC"]]);
            expect(llamadasDe("addOrderBy")).toEqual([["addOrderBy", "s.id", "DESC"]]);
        });

        it("salta las páginas anteriores y devuelve el total", async () => {
            siguiente = { manyAndCount: [[], 87] };

            const { total } = await adaptador.listarPagina({}, { numero: 3, limite: 20 });

            expect(llamadasDe("offset")).toEqual([["offset", 40]]);
            expect(llamadasDe("limit")).toEqual([["limit", 20]]);
            expect(total).toBe(87);
        });

        it("sinAsignar son las 'Enviada' sin agrónomo", async () => {
            await adaptador.listarPagina({ sinAsignar: true }, { numero: 1, limite: 20 });

            expect(llamadasDe("andWhere")).toEqual([
                ["andWhere", "s.agronomoId IS NULL"],
                ["andWhere", "s.estado = :enviada", { enviada: "Enviada" }],
            ]);
        });

        it("filtra por el agrónomo que recibe", async () => {
            await adaptador.listarPagina({ agronomoId: "a-1" }, { numero: 1, limite: 20 });

            expect(llamadasDe("andWhere")).toEqual([["andWhere", "s.agronomoId = :agronomoId", { agronomoId: "a-1" }]]);
        });
    });

    describe("contarBandeja", () => {
        it("cuenta todos los estados en una sola consulta agrupada", async () => {
            siguiente = {
                raw: [
                    { estado: "Enviada", casos: 7, sin_asignar: 4 },
                    { estado: "Resuelta", casos: 12, sin_asignar: 0 },
                ],
            };

            const conteo = await adaptador.contarBandeja({});

            expect(consultas).toHaveLength(1);
            expect(llamadasDe("groupBy")).toEqual([["groupBy", "s.estado"]]);
            expect(conteo).toEqual({
                porEstado: [
                    { estado: "Enviada", casos: 7 },
                    { estado: "Resuelta", casos: 12 },
                ],
                sinAsignar: 4,
            });
        });

        it("sinAsignar solo cuenta las 'Enviada' sin agrónomo", async () => {
            await adaptador.contarBandeja({});

            const [, expresion, alias] = llamadasDe("addSelect").find(([, , a]) => a === "sin_asignar") ?? [];
            expect(alias).toBe("sin_asignar");
            expect(expresion).toContain("s.agronomo_id IS NULL AND s.estado = 'Enviada'");
        });

        it("para un agrónomo cuenta solo lo suyo", async () => {
            await adaptador.contarBandeja({ agronomoId: "a-1" });

            expect(llamadasDe("where")).toEqual([["where", "s.agronomo_id = :agronomoId", { agronomoId: "a-1" }]]);
        });
    });

    describe("contarResueltasPorTipo", () => {
        it("solo cuenta solicitudes 'Resuelta' con fecha de resolución dentro de [desde, hasta)", async () => {
            const ventana = { desde: new Date("2026-09-05T00:00:00Z"), hasta: new Date("2026-10-05T00:00:00Z") };

            await adaptador.contarResueltasPorTipo(ventana);

            expect(llamadasDe("where")).toEqual([["where", "s.estado = :resuelta", { resuelta: "Resuelta" }]]);
            expect(llamadasDe("andWhere")).toEqual([
                ["andWhere", "s.fecha_resolucion >= :desde AND s.fecha_resolucion < :hasta", ventana],
            ]);
            expect(llamadasDe("groupBy")).toEqual([["groupBy", "s.tipo_resultado"]]);
        });
    });
});
