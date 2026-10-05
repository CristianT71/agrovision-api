import { MigrationInterface, QueryRunner } from "typeorm";

export class CrearMetricasModelo1790870387051 implements MigrationInterface {
    name = "CrearMetricasModelo1790870387051";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE "metricas_modelo" ("id" uuid NOT NULL, "modelo_id" uuid NOT NULL, "clase" character varying(100), "precision" real NOT NULL, "recall" real NOT NULL, "f1" real NOT NULL, CONSTRAINT "PK_59c03264672d4951c6fa396510b" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(`CREATE INDEX "IDX_1e4d92641d6459278444fe3914" ON "metricas_modelo" ("modelo_id") `);
        await queryRunner.query(
            `ALTER TABLE "metricas_modelo" ADD CONSTRAINT "FK_1e4d92641d6459278444fe3914c" FOREIGN KEY ("modelo_id") REFERENCES "modelos_ia"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "metricas_modelo" DROP CONSTRAINT "FK_1e4d92641d6459278444fe3914c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1e4d92641d6459278444fe3914"`);
        await queryRunner.query(`DROP TABLE "metricas_modelo"`);
    }
}
