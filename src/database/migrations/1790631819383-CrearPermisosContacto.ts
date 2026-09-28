import { MigrationInterface, QueryRunner } from "typeorm";

export class CrearPermisosContacto1790631819383 implements MigrationInterface {
    name = "CrearPermisosContacto1790631819383";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE "permisos_contacto" ("id" uuid NOT NULL, "solicitud_id" uuid NOT NULL, "agronomo_id" uuid, "habilitado" boolean NOT NULL DEFAULT false, "otorgado_por" uuid, "fecha_otorgado" TIMESTAMP, "revocado_por" uuid, "fecha_revocado" TIMESTAMP, CONSTRAINT "UQ_edabea4d0c429692a95d311b9b0" UNIQUE ("solicitud_id"), CONSTRAINT "REL_edabea4d0c429692a95d311b9b" UNIQUE ("solicitud_id"), CONSTRAINT "PK_77b5d8c622a821df2b5e8d26076" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `ALTER TABLE "permisos_contacto" ADD CONSTRAINT "FK_edabea4d0c429692a95d311b9b0" FOREIGN KEY ("solicitud_id") REFERENCES "solicitudes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "permisos_contacto" ADD CONSTRAINT "FK_b49d84f43049f251e32b5f982b5" FOREIGN KEY ("agronomo_id") REFERENCES "agronomos"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "permisos_contacto" ADD CONSTRAINT "FK_d466a68e4a26196861afe457c33" FOREIGN KEY ("otorgado_por") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "permisos_contacto" ADD CONSTRAINT "FK_31e19faaab5ac86eca1df4494ef" FOREIGN KEY ("revocado_por") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "permisos_contacto" DROP CONSTRAINT "FK_31e19faaab5ac86eca1df4494ef"`);
        await queryRunner.query(`ALTER TABLE "permisos_contacto" DROP CONSTRAINT "FK_d466a68e4a26196861afe457c33"`);
        await queryRunner.query(`ALTER TABLE "permisos_contacto" DROP CONSTRAINT "FK_b49d84f43049f251e32b5f982b5"`);
        await queryRunner.query(`ALTER TABLE "permisos_contacto" DROP CONSTRAINT "FK_edabea4d0c429692a95d311b9b0"`);
        await queryRunner.query(`DROP TABLE "permisos_contacto"`);
    }
}
