import { MigrationInterface, QueryRunner } from "typeorm";

// El modelo puede subirse solo con su labels.txt: las clases se guardan para mostrarlas en el panel
// aunque todavía no existan las etiquetas y la calibración que exige la app.
export class AgregarClasesModelo1792800000000 implements MigrationInterface {
    name = "AgregarClasesModelo1792800000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "modelos_ia" ADD "clases" jsonb`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "modelos_ia" DROP COLUMN "clases"`);
    }
}
