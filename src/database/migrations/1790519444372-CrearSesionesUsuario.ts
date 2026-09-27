import { MigrationInterface, QueryRunner } from "typeorm";

export class CrearSesionesUsuario1790519444372 implements MigrationInterface {
    name = "CrearSesionesUsuario1790519444372";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE "sesiones_usuario" ("id" uuid NOT NULL, "usuario_id" uuid NOT NULL, "rol" character varying(20) NOT NULL, "creada_en" TIMESTAMP WITH TIME ZONE NOT NULL, "expira_en" TIMESTAMP WITH TIME ZONE NOT NULL, "ultima_actividad" TIMESTAMP WITH TIME ZONE NOT NULL, "revocada_en" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_be14eb22d2e8fbf2ca6c3fe0d56" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(`CREATE INDEX "IDX_ae701bc730410988aebc6cf58a" ON "sesiones_usuario" ("usuario_id") `);
        await queryRunner.query(
            `ALTER TABLE "sesiones_usuario" ADD CONSTRAINT "FK_ae701bc730410988aebc6cf58ad" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "sesiones_usuario" DROP CONSTRAINT "FK_ae701bc730410988aebc6cf58ad"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ae701bc730410988aebc6cf58a"`);
        await queryRunner.query(`DROP TABLE "sesiones_usuario"`);
    }
}
