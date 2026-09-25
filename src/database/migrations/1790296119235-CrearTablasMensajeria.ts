import { MigrationInterface, QueryRunner } from "typeorm";

export class CrearTablasMensajeria1790296119235 implements MigrationInterface {
    name = "CrearTablasMensajeria1790296119235";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE "adjuntos_mensaje" ("id" uuid NOT NULL, "mensaje_id" uuid NOT NULL, "ruta" text NOT NULL, "nombre_archivo" character varying(255) NOT NULL, "tipo_mime" character varying(100) NOT NULL, "tamano_bytes" integer NOT NULL, "tipo" character varying(20) NOT NULL, CONSTRAINT "PK_9d4cdc45bd64a98bd1fc3a61cf4" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `CREATE TABLE "mensajes" ("id" uuid NOT NULL, "solicitud_id" uuid NOT NULL, "autor_id" uuid NOT NULL, "autor_tipo" character varying(20) NOT NULL, "contenido" text, "fecha" TIMESTAMP NOT NULL, "leido" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_20c919d08249bb93d84ce01beb4" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_6f32c216311d8318a14ad1fbe0" ON "mensajes"  ("solicitud_id", "leido") `,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_f7506ef91d47d76418c28f7042" ON "mensajes"  ("solicitud_id", "fecha") `,
        );
        await queryRunner.query(
            `ALTER TABLE "adjuntos_mensaje" ADD CONSTRAINT "FK_cda59b99657b685e77a663ec339" FOREIGN KEY ("mensaje_id") REFERENCES "mensajes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "mensajes" ADD CONSTRAINT "FK_27f4e19a5eae2a58d8292a286f2" FOREIGN KEY ("solicitud_id") REFERENCES "solicitudes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "mensajes" ADD CONSTRAINT "FK_27211b4beb1ecfc299fd23400f0" FOREIGN KEY ("autor_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "mensajes" DROP CONSTRAINT "FK_27211b4beb1ecfc299fd23400f0"`);
        await queryRunner.query(`ALTER TABLE "mensajes" DROP CONSTRAINT "FK_27f4e19a5eae2a58d8292a286f2"`);
        await queryRunner.query(`ALTER TABLE "adjuntos_mensaje" DROP CONSTRAINT "FK_cda59b99657b685e77a663ec339"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f7506ef91d47d76418c28f7042"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6f32c216311d8318a14ad1fbe0"`);
        await queryRunner.query(`DROP TABLE "mensajes"`);
        await queryRunner.query(`DROP TABLE "adjuntos_mensaje"`);
    }
}
