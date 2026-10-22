import { MigrationInterface, QueryRunner } from "typeorm";

// RNF-03.1: la bandeja paginada filtra por estado y ordena por fecha DESC.
// El índice de agronomo_id ya existe (CompletarResolucionSolicitudes): no se repite.
export class IndexarBandejaSolicitudes1791250000000 implements MigrationInterface {
    name = "IndexarBandejaSolicitudes1791250000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE INDEX "IDX_solicitudes_estado_fecha" ON "solicitudes" ("estado", "fecha" DESC) `,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_solicitudes_estado_fecha"`);
    }
}
