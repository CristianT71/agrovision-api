import { MigrationInterface, QueryRunner } from "typeorm";

// Términos y condiciones de uso del agrónomo: versión que aceptó al solicitar acceso y cuándo.
// Las cuentas anteriores a esta migración quedan en NULL: no registraron la aceptación.
export class AgregarTerminosAgronomos1793400000000 implements MigrationInterface {
    name = "AgregarTerminosAgronomos1793400000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "agronomos" ADD "terminos_version" character varying(20)`);
        await queryRunner.query(`ALTER TABLE "agronomos" ADD "terminos_fecha" TIMESTAMP`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "agronomos" DROP COLUMN "terminos_fecha"`);
        await queryRunner.query(`ALTER TABLE "agronomos" DROP COLUMN "terminos_version"`);
    }
}
