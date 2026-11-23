import { MigrationInterface, QueryRunner } from "typeorm";

export class CrearVuelos1793400000000 implements MigrationInterface {
    name = "CrearVuelos1793400000000";

    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE vuelos (
            id uuid PRIMARY KEY, nombre varchar(200) NOT NULL, lote varchar(200), notas text,
            creado_en timestamptz NOT NULL DEFAULT now(), creado_por uuid NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT
        )`);
        await queryRunner.query(`CREATE TABLE vuelo_archivos (
            id uuid PRIMARY KEY, vuelo_id uuid NOT NULL REFERENCES vuelos(id) ON DELETE CASCADE,
            nombre_original varchar(500) NOT NULL, tipo varchar(30) NOT NULL, banda varchar(10),
            mime varchar(100) NOT NULL, tamano_bytes bigint NOT NULL CHECK (tamano_bytes >= 0),
            sha256 char(64) NOT NULL, ruta_almacenamiento text NOT NULL, capturado_en timestamptz,
            latitud double precision, longitud double precision, altitud_absoluta_m double precision,
            altura_relativa_m double precision, tipo_altitud varchar(30), rtk_flag int,
            metadatos jsonb NOT NULL DEFAULT '{}', creado_en timestamptz NOT NULL DEFAULT now(),
            CONSTRAINT UQ_vuelo_archivos_sha256 UNIQUE (vuelo_id, sha256),
            CONSTRAINT CHK_vuelo_archivos_tipo CHECK (tipo IN ('foto_rgb','banda_multiespectral','video','srt','otro')),
            CONSTRAINT CHK_vuelo_archivos_banda CHECK (banda IS NULL OR (tipo = 'banda_multiespectral' AND banda IN ('green','red','rededge','nir')))
        )`);
        await queryRunner.query(`CREATE INDEX IDX_vuelo_archivos_tipo ON vuelo_archivos (vuelo_id, tipo)`);
        await queryRunner.query(`CREATE INDEX IDX_vuelo_archivos_captura ON vuelo_archivos (vuelo_id, capturado_en)`);
        // Sin FK al vuelo ni al archivo: el rastro sobrevive al borrado.
        await queryRunner.query(`CREATE TABLE auditoria_vuelos (
            id uuid PRIMARY KEY, accion varchar(30) NOT NULL,
            actor_usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
            vuelo_id uuid NOT NULL, archivo_id uuid, fecha timestamptz NOT NULL
        )`);
        await queryRunner.query(`CREATE INDEX IDX_auditoria_vuelos_vuelo_fecha ON auditoria_vuelos (vuelo_id, fecha)`);
        await queryRunner.query(
            `CREATE INDEX IDX_auditoria_vuelos_actor_fecha ON auditoria_vuelos (actor_usuario_id, fecha)`,
        );
        await queryRunner.query(`CREATE FUNCTION impedir_cambios_auditoria_vuelos() RETURNS trigger AS $$
            BEGIN RAISE EXCEPTION 'El registro de auditoría de vuelos es inmutable'; END; $$ LANGUAGE plpgsql`);
        await queryRunner.query(`CREATE TRIGGER auditoria_vuelos_inmutable BEFORE UPDATE OR DELETE ON auditoria_vuelos
            FOR EACH ROW EXECUTE FUNCTION impedir_cambios_auditoria_vuelos()`);
        await queryRunner.query(`CREATE TRIGGER auditoria_vuelos_sin_truncate BEFORE TRUNCATE ON auditoria_vuelos
            FOR EACH STATEMENT EXECUTE FUNCTION impedir_cambios_auditoria_vuelos()`);
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE auditoria_vuelos`);
        await queryRunner.query(`DROP FUNCTION impedir_cambios_auditoria_vuelos()`);
        await queryRunner.query(`DROP TABLE vuelo_archivos`);
        await queryRunner.query(`DROP TABLE vuelos`);
    }
}
