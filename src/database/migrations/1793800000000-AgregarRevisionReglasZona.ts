import { MigrationInterface, QueryRunner } from "typeorm";

// Control de concurrencia optimista de los borradores: `revision` empieza en 1 y sube con cada modificación.
// Editar y aprobar envían la revisión que el cliente vio y solo aplican si sigue siendo la misma.
// No es la versión de publicación (`version`) ni se expone en el endpoint público.
export class AgregarRevisionReglasZona1793800000000 implements MigrationInterface {
    name = "AgregarRevisionReglasZona1793800000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "reglas_zona" ADD COLUMN "revision" integer NOT NULL DEFAULT 1`);
        await queryRunner.query(
            `ALTER TABLE "reglas_zona" ADD CONSTRAINT "CHK_reglas_zona_revision" CHECK ("revision" >= 1)`,
        );
    }

    // Solo quita la columna (y con ella su CHECK): no toca reglas, filas ni el historial de auditoría.
    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "reglas_zona" DROP COLUMN IF EXISTS "revision"`);
    }
}
