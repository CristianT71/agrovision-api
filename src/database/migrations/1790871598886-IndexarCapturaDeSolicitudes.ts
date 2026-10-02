import { MigrationInterface, QueryRunner } from "typeorm";

export class IndexarCapturaDeSolicitudes1790871598886 implements MigrationInterface {
    name = "IndexarCapturaDeSolicitudes1790871598886";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX "IDX_478cc0d1b85fd96f129f228b7b" ON "solicitudes" ("captura_id") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_478cc0d1b85fd96f129f228b7b"`);
    }
}
