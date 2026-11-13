import { MigrationInterface, QueryRunner } from "typeorm";

export class SincronizacionPublicaPlagas1793500000000 implements MigrationInterface {
    name = "SincronizacionPublicaPlagas1793500000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE plagas ADD COLUMN catalog_id varchar(100),
                ADD COLUMN updated_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
                ADD COLUMN catalog_version integer NOT NULL DEFAULT 1 CHECK (catalog_version > 0);
            UPDATE plagas SET catalog_id = 'Pest_' || id::text;
        `);
        // Mismo par UUID/appId de SembrarCatalogoPlagas1793100000000. Nunca se cambia la PK.
        const ids = [
            ["dd8cfa55-a7a6-5e64-80b3-32c106f5ff19", "Enfermedad_Roya"],
            ["c3e5bbaa-8ede-5235-b50a-1d815216d938", "Enfermedad_ManchadeHierro"],
            ["86d53402-e95a-52a7-ab5d-b8b469fb7eeb", "Enfermedad_OjodeGallo"],
            ["d5741c2b-1604-5c68-ab7f-3f2a9309087d", "Enfermedad_Antracnosis"],
            ["7bf4dc8f-0d24-5f8a-b360-de25f56b3a78", "Deficiencia_Azufre"],
            ["9c469f9c-409a-53df-a013-62be21218c1b", "Deficiencia_Potasio"],
            ["27f3d9ea-5211-5583-a683-b8891da1e561", "Enfermedad_Phoma"],
            ["f07804ae-b272-514f-bec4-b96013f87c10", "Plaga_Minador"],
        ];
        for (const [uuid, catalogId] of ids) {
            await queryRunner.query(`UPDATE plagas SET catalog_id = $2 WHERE id = $1`, [uuid, catalogId]);
        }
        await queryRunner.query(`
            ALTER TABLE plagas ALTER COLUMN catalog_id SET NOT NULL,
                ADD CONSTRAINT uq_plagas_catalog_id UNIQUE (catalog_id);
            CREATE INDEX idx_plagas_updated_at ON plagas (updated_at);

            ALTER TABLE avales_plaga ADD COLUMN nombre_agronomo varchar(150);
            UPDATE avales_plaga a SET nombre_agronomo = g.nombre FROM agronomos g WHERE g.id = a.agronomo_id;
            ALTER TABLE avales_plaga ALTER COLUMN nombre_agronomo SET NOT NULL;

            -- Sin FK: la baja sobrevive al DELETE y a sus cascadas. No se purga por antigüedad.
            CREATE TABLE plagas_catalogo_bajas (
                catalog_id varchar(100) PRIMARY KEY,
                deleted_at timestamptz(3) NOT NULL
            );
            CREATE INDEX idx_plagas_catalogo_bajas_fecha ON plagas_catalogo_bajas (deleted_at);

            CREATE FUNCTION plagas_catalogo_actualizar() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN
                IF TG_OP = 'INSERT' THEN
                    NEW.catalog_id := COALESCE(NEW.catalog_id, 'Pest_' || NEW.id::text);
                    IF EXISTS (SELECT 1 FROM plagas_catalogo_bajas WHERE catalog_id = NEW.catalog_id) THEN
                        RAISE EXCEPTION 'Un id de catálogo dado de baja no se puede reutilizar';
                    END IF;
                    NEW.catalog_version := 1;
                ELSE
                    IF NEW.catalog_id IS DISTINCT FROM OLD.catalog_id THEN
                        RAISE EXCEPTION 'El id de catálogo es inmutable';
                    END IF;
                    NEW.catalog_version := OLD.catalog_version + 1;
                END IF;
                -- clock_timestamp, no now(): un escritor que espere al sync debe quedar después del cursor.
                NEW.updated_at := date_trunc('milliseconds', clock_timestamp());
                RETURN NEW;
            END; $$;
            CREATE TRIGGER tr_plagas_catalogo_actualizar BEFORE INSERT OR UPDATE ON plagas
                FOR EACH ROW EXECUTE FUNCTION plagas_catalogo_actualizar();

            CREATE FUNCTION plagas_catalogo_relacion() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN
                IF TG_OP <> 'INSERT' THEN
                    UPDATE plagas SET updated_at = clock_timestamp() WHERE id = OLD.plaga_id;
                END IF;
                IF TG_OP <> 'DELETE' THEN
                    IF TG_OP = 'INSERT' THEN
                        UPDATE plagas SET updated_at = clock_timestamp() WHERE id = NEW.plaga_id;
                    ELSIF NEW.plaga_id IS DISTINCT FROM OLD.plaga_id THEN
                        UPDATE plagas SET updated_at = clock_timestamp() WHERE id = NEW.plaga_id;
                    END IF;
                END IF;
                RETURN NULL;
            END; $$;
            CREATE TRIGGER tr_sinonimos_catalogo AFTER INSERT OR UPDATE OR DELETE ON sinonimos_plaga
                FOR EACH ROW EXECUTE FUNCTION plagas_catalogo_relacion();
            CREATE TRIGGER tr_avales_catalogo AFTER INSERT OR UPDATE OR DELETE ON avales_plaga
                FOR EACH ROW EXECUTE FUNCTION plagas_catalogo_relacion();

            CREATE FUNCTION plagas_catalogo_borrar() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN
                INSERT INTO plagas_catalogo_bajas (catalog_id, deleted_at)
                    VALUES (OLD.catalog_id, date_trunc('milliseconds', clock_timestamp()));
                RETURN OLD;
            END; $$;
            CREATE TRIGGER tr_plagas_catalogo_borrar BEFORE DELETE ON plagas
                FOR EACH ROW EXECUTE FUNCTION plagas_catalogo_borrar();
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DROP TRIGGER tr_plagas_catalogo_borrar ON plagas;
            DROP TRIGGER tr_avales_catalogo ON avales_plaga;
            DROP TRIGGER tr_sinonimos_catalogo ON sinonimos_plaga;
            DROP TRIGGER tr_plagas_catalogo_actualizar ON plagas;
            DROP FUNCTION plagas_catalogo_borrar();
            DROP FUNCTION plagas_catalogo_relacion();
            DROP FUNCTION plagas_catalogo_actualizar();
            DROP TABLE plagas_catalogo_bajas;
            ALTER TABLE avales_plaga DROP COLUMN nombre_agronomo;
            ALTER TABLE plagas DROP COLUMN catalog_id, DROP COLUMN updated_at, DROP COLUMN catalog_version;
        `);
    }
}
