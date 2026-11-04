import { MigrationInterface, QueryRunner } from "typeorm";

// Habeas data (Ley 1581 de 2012): versión de la política de tratamiento de datos que aceptó cada
// persona y cuándo. Es la prueba de la autorización previa, expresa e informada.
export class AgregarPoliticaDatosUsuarios1793200000000 implements MigrationInterface {
    name = "AgregarPoliticaDatosUsuarios1793200000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "usuarios" ADD "politica_datos_version" character varying(20)`);
        await queryRunner.query(`ALTER TABLE "usuarios" ADD "politica_datos_fecha" TIMESTAMP`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "usuarios" DROP COLUMN "politica_datos_fecha"`);
        await queryRunner.query(`ALTER TABLE "usuarios" DROP COLUMN "politica_datos_version"`);
    }
}
