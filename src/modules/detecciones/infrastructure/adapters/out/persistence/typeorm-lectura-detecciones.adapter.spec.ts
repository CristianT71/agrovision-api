import type { Repository } from "typeorm";
import { TypeOrmLecturaDeteccionesAdapter } from "./typeorm-lectura-detecciones.adapter";
import type { TypeOrmDeteccionEntity } from "./typeorm-deteccion.entity";

jest.mock("@nestjs/typeorm", () => ({ InjectRepository: () => () => undefined }));

// Sin PostgreSQL: se comprueba que todas las lecturas condicionan las coordenadas al consentimiento
describe("TypeOrmLecturaDeteccionesAdapter: coordenadas y consentimiento", () => {
    const query = jest.fn<Promise<unknown[]>, [string, unknown[]?]>();
    const adapter = new TypeOrmLecturaDeteccionesAdapter({ query } as unknown as Repository<TypeOrmDeteccionEntity>);

    beforeEach(() => query.mockReset().mockResolvedValue([]));

    const sql = (llamada = 0) => query.mock.calls[llamada][0].replace(/\s+/g, " ");

    it("el mapa solo trae detecciones cuyo productor mantiene el consentimiento", async () => {
        await adapter.listarMapa({}, 100);

        expect(sql()).toContain("d.latitud IS NOT NULL AND d.longitud IS NOT NULL AND p.consentimiento IS TRUE");
    });

    it("solo atribuye a la captura resoluciones de solicitudes del mismo productor", async () => {
        await adapter.obtener("d-1");

        expect(sql()).toContain("s.captura_id = d.id_cliente AND s.productor_id = d.productor_id");
    });

    it("el detalle (y con él el KML) y el listado ocultan las coordenadas sin consentimiento", async () => {
        await adapter.obtener("d-1");
        await adapter.listar({}, { numero: 1, limite: 10 });

        for (const llamada of [0, 2]) {
            expect(sql(llamada)).toContain("CASE WHEN p.consentimiento IS TRUE THEN d.latitud END AS latitud");
            expect(sql(llamada)).toContain("CASE WHEN p.consentimiento IS TRUE THEN d.longitud END AS longitud");
            expect(sql(llamada)).not.toMatch(/d\.organo, d\.latitud/);
        }
    });
});
