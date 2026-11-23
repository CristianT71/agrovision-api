import type { Repository } from "typeorm";
import { TypeOrmCatalogoRepository } from "./typeorm-catalogo.repository";
import type { TypeOrmPlagaEntity } from "./typeorm-plaga.entity";

jest.mock("@nestjs/typeorm", () => ({ InjectRepository: () => () => undefined }));

function preparar() {
    const query = jest.fn<Promise<unknown[]>, [string, unknown[]?]>().mockImplementation((sql: string) => {
        if (sql.includes('AS "serverTime"')) return Promise.resolve([{ serverTime: 5000 }]);
        if (sql.includes("FROM plagas_catalogo_bajas")) return Promise.resolve([{ catalogId: "Plaga_Minador" }]);
        if (sql.includes("FROM plagas p"))
            return Promise.resolve([
                {
                    catalogId: "Enfermedad_Roya",
                    version: 3,
                    nombreAgronomo: "Ana",
                    numeroTarjeta: "TP-12",
                    fechaAval: new Date(3000),
                },
            ]);
        return Promise.resolve([]);
    });
    const transaction = jest.fn((_isolation: string, trabajo: (manager: { query: typeof query }) => unknown) =>
        trabajo({ query }),
    );
    const repository = { manager: { transaction } } as unknown as Repository<TypeOrmPlagaEntity>;
    return { repo: new TypeOrmCatalogoRepository(repository), query, transaction };
}

describe("TypeOrmCatalogoRepository", () => {
    it("primer sync lee todas las vigentes y no envía bajas históricas", async () => {
        const { repo, query, transaction } = preparar();
        const delta = await repo.leerDelta();
        expect(transaction).toHaveBeenCalledTimes(1);
        expect(query.mock.calls[0]).toEqual(["LOCK TABLE plagas IN SHARE MODE"]);
        const [sql, parametros] = query.mock.calls[2];
        expect(sql).toContain("$1::timestamptz IS NULL");
        expect(parametros).toEqual([null]);
        expect(query).toHaveBeenCalledTimes(3);
        expect(delta).toMatchObject({ deletedIds: [], serverTime: 5000, fichas: [{ catalogId: "Enfermedad_Roya" }] });
    });

    it("delta filtra por updated_at y deleted_at, incluyendo el milisegundo del cursor", async () => {
        const { repo, query } = preparar();
        const delta = await repo.leerDelta(2000);
        expect(query.mock.calls[2][0]).toContain("p.updated_at >= $1::timestamptz");
        expect(query.mock.calls[2][1]).toEqual([new Date(2000)]);
        expect(query.mock.calls[3][0]).toContain("deleted_at >= $1");
        expect(query.mock.calls[3][1]).toEqual([new Date(2000)]);
        expect(delta.deletedIds).toEqual(["Plaga_Minador"]);
        expect(delta.fichas[0].aval).toEqual({
            nombreAgronomo: "Ana",
            numeroTarjeta: "TP-12",
            fechaAval: new Date(3000),
        });
        expect(query.mock.calls[2][0]).not.toMatch(/usuario_id|correo|telefono|estado/);
    });
});
