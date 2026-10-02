import { MigrationInterface, QueryRunner } from "typeorm";

export class CrearModelosIa1790870151265 implements MigrationInterface {
    name = "CrearModelosIa1790870151265";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE "modelos_ia" ("id" uuid NOT NULL, "version" character varying(30) NOT NULL, "formato" character varying(10) NOT NULL, "canal" character varying(20) NOT NULL, "version_min_app" character varying(30) NOT NULL, "notas" text, "ruta_modelo" character varying(255) NOT NULL, "ruta_etiquetas" character varying(255), "ruta_calibracion" character varying(255), "tamano_bytes" integer NOT NULL, "sha256" character varying(64) NOT NULL, "firma" character varying(100), "numero_clases" integer, "activo" boolean NOT NULL DEFAULT false, "creado_por" uuid NOT NULL, "fecha_creacion" TIMESTAMP NOT NULL, "fecha_publicacion" TIMESTAMP, "porcentaje_canario" integer, "kill_switch" boolean NOT NULL DEFAULT false, "motivo_kill_switch" text, "fecha_kill_switch" TIMESTAMP, CONSTRAINT "UQ_0d44caf333fdc2b72c72fba4af2" UNIQUE ("version"), CONSTRAINT "PK_8c7609c5f30f903dfe0bc3674d5" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(`CREATE INDEX "IDX_1281657d5267f8fbb16ca0d214" ON "modelos_ia" ("canal") `);
        await queryRunner.query(
            `ALTER TABLE "modelos_ia" ADD CONSTRAINT "FK_f4a61c02479610c9b2be94064dc" FOREIGN KEY ("creado_por") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "modelos_ia" DROP CONSTRAINT "FK_f4a61c02479610c9b2be94064dc"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1281657d5267f8fbb16ca0d214"`);
        await queryRunner.query(`DROP TABLE "modelos_ia"`);
    }
}
