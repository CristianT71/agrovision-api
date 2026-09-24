import { MigrationInterface, QueryRunner } from "typeorm";

export class ProtegerSesionesOtp1790287841962 implements MigrationInterface {
    name = "ProtegerSesionesOtp1790287841962";

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Los códigos existentes están en texto plano y duran 5 minutos: se descartan en vez de migrarlos
        await queryRunner.query(`DELETE FROM "sesiones_otp"`);
        await queryRunner.query(`ALTER TABLE "sesiones_otp" DROP COLUMN "codigo"`);
        await queryRunner.query(`ALTER TABLE "sesiones_otp" ADD "codigo_hash" character varying(64) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "sesiones_otp" ADD "intentos" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(
            `CREATE INDEX "IDX_ddb6fba4ee387cd4c2fe40c532" ON "sesiones_otp" ("usuario_id", "creado_en") `,
        );
        await queryRunner.query(
            `ALTER TABLE "sesiones_otp" ADD CONSTRAINT "FK_e814d9a863c1a4775a72d20625a" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "sesiones_otp" DROP CONSTRAINT "FK_e814d9a863c1a4775a72d20625a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ddb6fba4ee387cd4c2fe40c532"`);
        await queryRunner.query(`DELETE FROM "sesiones_otp"`);
        await queryRunner.query(`ALTER TABLE "sesiones_otp" DROP COLUMN "intentos"`);
        await queryRunner.query(`ALTER TABLE "sesiones_otp" DROP COLUMN "codigo_hash"`);
        await queryRunner.query(`ALTER TABLE "sesiones_otp" ADD "codigo" character varying(6) NOT NULL`);
    }
}
