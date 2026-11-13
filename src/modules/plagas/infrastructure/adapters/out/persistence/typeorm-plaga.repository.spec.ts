import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Repository } from "typeorm";
import type { IAlmacenamientoArchivos } from "../../../../../../common/almacenamiento/almacenamiento.port";
import { EliminarPlagaService } from "../../../../application/use-cases/eliminar-plaga.service";
import { ObtenerPlagaService } from "../../../../application/use-cases/obtener-plaga.service";
import { SincronizarCatalogoService } from "../../../../application/use-cases/sincronizar-catalogo.service";
import { TypeOrmCatalogoRepository } from "./typeorm-catalogo.repository";
import { TypeOrmPlagaRepository } from "./typeorm-plaga.repository";
import type { TypeOrmPlagaEntity } from "./typeorm-plaga.entity";

jest.mock("@nestjs/typeorm", () => ({ InjectRepository: () => () => undefined }));
jest.mock("uuid", () => ({ v4: () => crypto.randomUUID() }));

const ID = "11111111-1111-4111-8111-111111111111";
const ficha = (catalogId = `Pest_${ID}`): TypeOrmPlagaEntity => ({
    id: ID,
    catalogId,
    updatedAt: new Date(1000),
    catalogVersion: 1,
    nombreComun: "Roya",
    nombreCientifico: null,
    tipo: "enfermedad",
    descripcion: "Descripción",
    sintomas: "Síntomas",
    cultivo: "cafe",
    organosAfectados: ["hoja"],
    hospederos: [],
    medidasContencion: "Manejo",
    protocoloQuimico: null,
    fotoUrl: null,
    sinonimos: [],
    avales: [],
});

describe("TypeOrmPlagaRepository - eliminación y protección", () => {
    it.each([
        [`Pest_${ID}`, false],
        ["Enfermedad_Roya", true],
        ["Plaga_Minador", true],
    ])(
        "mapea catalog_id %s a protegida=%s en fichas individuales, listas y respuestas JSON",
        async (catalogId, protegida) => {
            const fila = ficha(catalogId as string);
            const repository = {
                findOne: jest.fn().mockResolvedValue(fila),
                find: jest.fn().mockResolvedValue([fila]),
            } as unknown as Repository<TypeOrmPlagaEntity>;
            const repo = new TypeOrmPlagaRepository(repository);
            expect(JSON.parse(JSON.stringify(await repo.findById(ID))).protegida).toBe(protegida);
            expect(JSON.parse(JSON.stringify(await repo.findAll()))[0].protegida).toBe(protegida);
        },
    );

    it("una ficha creada por el agrónomo nace sin protección y se recarga tras guardar", async () => {
        const fila = ficha();
        const repository = {
            findOne: jest.fn().mockResolvedValue(fila),
            save: jest.fn().mockResolvedValue(fila),
        } as unknown as Repository<TypeOrmPlagaEntity>;
        const repo = new TypeOrmPlagaRepository(repository);
        const plaga = (await repo.findById(ID))!;
        expect((await repo.guardar(plaga)).protegida).toBe(false);
        expect(repository.save).toHaveBeenCalledWith(expect.not.objectContaining({ protegida: expect.anything() }));
    });

    it.each([1, 0, undefined])("DELETE informa las filas afectadas (%p) sin escribir otra baja", async (affected) => {
        const borrar = jest.fn().mockResolvedValue({ affected });
        const repo = new TypeOrmPlagaRepository({ delete: borrar } as unknown as Repository<TypeOrmPlagaEntity>);
        expect(await repo.eliminar(ID)).toBe(affected === 1);
        expect(borrar).toHaveBeenCalledWith({ id: ID });
    });

    it.each([0, 1, 2])("consulta referencias exactas a la foto (%i fichas)", async (referencias) => {
        const countBy = jest.fn().mockResolvedValue(referencias);
        const repo = new TypeOrmPlagaRepository({ countBy } as unknown as Repository<TypeOrmPlagaEntity>);
        expect(await repo.fotoEnUso("/archivos/plagas/foto.png")).toBe(referencias > 0);
        expect(countBy).toHaveBeenCalledWith({ fotoUrl: "/archivos/plagas/foto.png" });
    });

    it("tras el DELETE, el sync publica catalog_id en deletedIds (trigger simulado, sin PostgreSQL)", async () => {
        let vigente: TypeOrmPlagaEntity | null = ficha();
        const bajas: { catalogId: string; deletedAt: number }[] = [];
        const borrar = jest.fn(({ id }: { id: string }) => {
            if (!vigente || vigente.id !== id) return Promise.resolve({ affected: 0 });
            // Emula únicamente el efecto del trigger BEFORE DELETE ya instalado.
            bajas.push({ catalogId: vigente.catalogId, deletedAt: 3000 });
            vigente = null;
            return Promise.resolve({ affected: 1 });
        });
        const query = jest.fn(async (sql: string, params?: unknown[]) => {
            if (sql.includes('AS "serverTime"')) return [{ serverTime: 5000 }];
            if (sql.includes("FROM plagas_catalogo_bajas")) {
                const since = (params![0] as Date).getTime();
                return bajas.filter((baja) => baja.deletedAt >= since).map(({ catalogId }) => ({ catalogId }));
            }
            if (sql.includes("FROM plagas p")) return vigente ? [vigente] : [];
            return [];
        });
        const db = {
            findOne: jest.fn(async () => vigente),
            delete: borrar,
            manager: {
                transaction: async (_nivel: string, trabajo: (manager: { query: typeof query }) => unknown) =>
                    trabajo({ query }),
            },
        } as unknown as Repository<TypeOrmPlagaEntity>;
        const repo = new TypeOrmPlagaRepository(db);
        const sync = new SincronizarCatalogoService(new TypeOrmCatalogoRepository(db), { urlPublica: () => null });
        expect((await sync.ejecutar(2000)).deletedIds).toEqual([]);
        const eliminarPublico = jest.fn();
        await new EliminarPlagaService(
            repo,
            { eliminarPublico } as unknown as IAlmacenamientoArchivos,
            new ObtenerPlagaService(repo),
        ).ejecutar(ID);
        expect(borrar).toHaveBeenCalledWith({ id: ID });
        expect(await repo.findById(ID)).toBeNull();
        expect(bajas).toEqual([{ catalogId: `Pest_${ID}`, deletedAt: 3000 }]);
        expect(await sync.ejecutar(2000)).toMatchObject({ upserted: [], deletedIds: [`Pest_${ID}`] });
        expect((await sync.ejecutar(3000)).deletedIds).toEqual([`Pest_${ID}`]);
        expect((await sync.ejecutar(3001)).deletedIds).toEqual([]);
        expect((await sync.ejecutar()).deletedIds).toEqual([]);

        // El SQL existente respalda la simulación; se lee el archivo, no se ejecuta la migración.
        const sql = readFileSync(
            join(__dirname, "../../../../../../database/migrations/1793500000000-SincronizacionPublicaPlagas.ts"),
            "utf8",
        );
        expect(sql).toMatch(/INSERT INTO plagas_catalogo_bajas \(catalog_id, deleted_at\)\s+VALUES \(OLD.catalog_id,/);
        expect(sql).toContain("tr_plagas_catalogo_borrar BEFORE DELETE ON plagas");
    });
});
