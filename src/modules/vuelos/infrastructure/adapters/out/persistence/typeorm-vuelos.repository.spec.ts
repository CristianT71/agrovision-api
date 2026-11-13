import type { DataSource, EntityManager } from "typeorm";
import { TypeOrmVuelosRepository, SQL_RESUMEN, resumenVacio } from "./typeorm-vuelos.repository";
import type { TypeOrmAuditoriaVuelosAdapter } from "./typeorm-auditoria-vuelos.adapter";
import type { ArchivoVuelo, PuntoTraza } from "../../../../domain/entities/vuelo";
import { normalizarTags } from "../../../../domain/services/normalizar-tags";
import { construirTraza } from "../../../../domain/services/traza";
jest.mock("typeorm", () => ({ DataSource: class {} }));
const id = "11111111-1111-4111-8111-111111111111";
describe("Persistencia y agregados de vuelos", () => {
    const query = jest.fn(),
        registrarConGestor = jest.fn();
    const tx = { query } as unknown as EntityManager;
    const db = { query, transaction: jest.fn(async (fn: (m: EntityManager) => Promise<unknown>) => fn(tx)) };
    const repo = new TypeOrmVuelosRepository(
        db as unknown as DataSource,
        { registrarConGestor } as unknown as TypeOrmAuditoriaVuelosAdapter,
    );
    beforeEach(() => {
        query.mockReset();
        registrarConGestor.mockReset();
        db.transaction.mockClear();
    });
    it("obtiene conteos, sumas, medias, extremos y RTK en una consulta agrupada", async () => {
        const resumen = {
            totalArchivos: 4,
            porTipo: { foto_rgb: 1, banda_multiespectral: 1, video: 1, srt: 1, otro: 0 },
            tamanoTotalBytes: 1000,
            primeraCapturaEn: "2026-11-12T19:00:00Z",
            ultimaCapturaEn: "2026-11-12T19:00:10Z",
            duracionSegundos: 10,
            altitudAbsolutaM: { min: 1300, max: 1400, media: 1350 },
            alturaRelativaM: { min: 70, max: 90, media: 80 },
            caja: { sur: 1, oeste: -77, norte: 2, este: -76 },
            centro: { latitud: 1.5, longitud: -76.5 },
            rtk: { fijo: 1, otro: 2, sinDato: 1 },
            dron: null,
        };
        query.mockResolvedValue([{ vuelo_id: id, resumen }]);
        expect(await repo.resumen([id, "otro"])).toEqual({ [id]: resumen, otro: resumenVacio() });
        expect(query).toHaveBeenCalledTimes(1);
        expect(query).toHaveBeenCalledWith(SQL_RESUMEN, [[id, "otro"]]);
        // Contrato de la consulta: agregación en PostgreSQL, sin seleccionar filas completas.
        expect(SQL_RESUMEN).toContain("GROUP BY vuelo_id");
        expect(SQL_RESUMEN).toContain("avg(altitud_absoluta_m)");
        expect(SQL_RESUMEN).toContain("sum(tamano_bytes)");
        expect(SQL_RESUMEN).toContain("WHERE rtk_flag=50");
    });
    it("un vuelo sin archivos tiene bloques nulos y no consulta un lote vacío", async () => {
        expect(await repo.resumen([])).toEqual({});
        expect(query).not.toHaveBeenCalled();
        query.mockResolvedValue([]);
        expect((await repo.resumen([id]))[id]).toEqual(resumenVacio());
    });
    it("ordena la traza por captura y creación en SQL, limita a 2001 y anuncia el recorte", async () => {
        const filas = Array.from({ length: 2001 }, (_, i) => ({
            id: String(i),
            tipo: "foto_rgb",
            banda: null,
            capturado_en: new Date(1000 * i),
            latitud: 1 + i / 100000,
            longitud: -76,
            altitud_absoluta_m: 1300 + i,
        }));
        query.mockResolvedValue(filas);
        const puntos = await repo.puntos(id),
            traza = construirTraza(puntos);
        expect(query.mock.calls[0][0]).toContain(
            "ORDER BY capturado_en ASC NULLS LAST,creado_en ASC,id ASC LIMIT 2001",
        );
        expect(traza.truncado).toBe(true);
        expect(traza.features).toHaveLength(2001);
        expect(traza.features[0]).toMatchObject({
            properties: { archivoId: "0" },
            geometry: { coordinates: [-76, 1] },
        });
        expect(traza.features[1999]).toMatchObject({ properties: { archivoId: "1999" } });
        expect(traza.features[2000]).toMatchObject({
            geometry: { type: "LineString", coordinates: expect.any(Array) },
        });
        expect(construirTraza([])).toEqual({ type: "FeatureCollection", features: [], truncado: false });
    });
    it("filtra pertenencia del archivo dentro de SQL", async () => {
        query.mockResolvedValue([]);
        expect(await repo.archivo("archivo", id)).toBeNull();
        expect(query.mock.calls[0]).toEqual([expect.stringContaining("WHERE id=$1 AND vuelo_id=$2"), ["archivo", id]]);
    });
    it("crea y audita con el mismo gestor transaccional", async () => {
        query.mockResolvedValue([]);
        await repo.crearAuditado({
            id,
            nombre: "vuelo",
            lote: null,
            notas: null,
            creadoEn: new Date(),
            creadoPor: "actor",
        });
        expect(db.transaction).toHaveBeenCalledTimes(1);
        expect(registrarConGestor).toHaveBeenCalledWith(tx, {
            accion: "vuelo_creado",
            actorUsuarioId: "actor",
            vueloId: id,
        });
    });
    it("audita antes de eliminar y propaga fallos de auditoría para revertir", async () => {
        query.mockResolvedValue([{ id }]);
        registrarConGestor.mockRejectedValue(new Error("auditoria"));
        await expect(repo.eliminarAuditado(id, "actor")).rejects.toThrow("auditoria");
        expect(query).toHaveBeenCalledTimes(1);
    });
    it("resuelve la carrera UNIQUE bajo bloqueo y devuelve el archivo existente", async () => {
        const a: ArchivoVuelo = {
            ...normalizarTags({}, "a.jpg"),
            id: "nuevo",
            vueloId: id,
            nombreOriginal: "a.jpg",
            mime: "image/jpeg",
            tamanoBytes: 2,
            sha256: "hash",
            rutaAlmacenamiento: "ruta",
            creadoEn: new Date(),
        };
        const existente = {
            id: "existente",
            vuelo_id: id,
            nombre_original: "a.jpg",
            tipo: "foto_rgb",
            banda: null,
            mime: "image/jpeg",
            tamano_bytes: "2",
            sha256: "hash",
            ruta_almacenamiento: "ruta-vieja",
            capturado_en: null,
            latitud: null,
            longitud: null,
            altitud_absoluta_m: null,
            altura_relativa_m: null,
            tipo_altitud: null,
            rtk_flag: null,
            metadatos: a.metadatos,
            creado_en: a.creadoEn,
        };
        query.mockResolvedValueOnce([{ id }]).mockResolvedValueOnce([]).mockResolvedValueOnce([existente]);
        expect(await repo.guardarArchivo(a)).toMatchObject({
            duplicado: true,
            archivo: { id: "existente", tamanoBytes: 2 },
        });
        expect(query.mock.calls[0][0]).toContain("FOR UPDATE");
        expect(query.mock.calls[1][0]).toContain("ON CONFLICT (vuelo_id,sha256) DO NOTHING");
    });
});
