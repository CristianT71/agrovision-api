import { MigrationInterface, QueryRunner } from "typeorm";

export class CompletarResolucionSolicitudes1790287841963 implements MigrationInterface {
    name = "CompletarResolucionSolicitudes1790287841963";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "solicitudes" ADD "plaga_identificada" character varying(150)`);
        await queryRunner.query(`ALTER TABLE "solicitudes" ADD "fecha_resolucion" TIMESTAMP`);
        await queryRunner.query(`CREATE INDEX "IDX_33a61da8c2d39f11f20b70c7c3" ON "solicitudes" ("agronomo_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_d3d19f7c369601691999a4f34b" ON "solicitudes" ("estado") `);
        // Si hay solicitudes de prueba que apuntan a productores o agrónomos inexistentes,
        // estas llaves fallan: hay que corregir o borrar esas filas antes de migrar
        await queryRunner.query(
            `ALTER TABLE "solicitudes" ADD CONSTRAINT "FK_2db548cff5da2fb8d9d4aec1e19" FOREIGN KEY ("productor_id") REFERENCES "productores"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "solicitudes" ADD CONSTRAINT "FK_33a61da8c2d39f11f20b70c7c3f" FOREIGN KEY ("agronomo_id") REFERENCES "agronomos"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "solicitudes" DROP CONSTRAINT "FK_33a61da8c2d39f11f20b70c7c3f"`);
        await queryRunner.query(`ALTER TABLE "solicitudes" DROP CONSTRAINT "FK_2db548cff5da2fb8d9d4aec1e19"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d3d19f7c369601691999a4f34b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_33a61da8c2d39f11f20b70c7c3"`);
        await queryRunner.query(`ALTER TABLE "solicitudes" DROP COLUMN "fecha_resolucion"`);
        await queryRunner.query(`ALTER TABLE "solicitudes" DROP COLUMN "plaga_identificada"`);
    }
}
