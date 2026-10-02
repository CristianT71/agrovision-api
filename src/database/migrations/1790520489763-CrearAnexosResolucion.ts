import { MigrationInterface, QueryRunner } from "typeorm";

export class CrearAnexosResolucion1790520489763 implements MigrationInterface {
    name = "CrearAnexosResolucion1790520489763";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE "anexos_resolucion" ("id" uuid NOT NULL, "solicitud_id" uuid NOT NULL, "ruta" character varying(255) NOT NULL, "nombre_original" character varying(255) NOT NULL, "tipo_mime" character varying(100) NOT NULL, "tamano_bytes" integer NOT NULL, "fecha_subida" TIMESTAMP NOT NULL, CONSTRAINT "PK_2f44b9a53221b15c50c7a6d90b4" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_44c6a7a35f956248b662170f10" ON "anexos_resolucion" ("solicitud_id") `,
        );
        await queryRunner.query(
            `ALTER TABLE "anexos_resolucion" ADD CONSTRAINT "FK_44c6a7a35f956248b662170f107" FOREIGN KEY ("solicitud_id") REFERENCES "solicitudes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "anexos_resolucion" DROP CONSTRAINT "FK_44c6a7a35f956248b662170f107"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_44c6a7a35f956248b662170f10"`);
        await queryRunner.query(`DROP TABLE "anexos_resolucion"`);
    }
}
