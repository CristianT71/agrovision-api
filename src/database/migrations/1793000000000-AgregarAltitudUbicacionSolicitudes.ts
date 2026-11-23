import { MigrationInterface, QueryRunner } from "typeorm";

// Altitud y calidad de la ubicación de cada solicitud, para el detalle y el mapa de casos del panel.
// El índice parcial cubre la consulta del mapa (estado, fecha DESC) sin indexar las solicitudes sin ubicación.
export class AgregarAltitudUbicacionSolicitudes1793000000000 implements MigrationInterface {
    name = "AgregarAltitudUbicacionSolicitudes1793000000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "solicitudes" ADD "altitud_msnm" numeric(7,2)`);
        await queryRunner.query(`ALTER TABLE "solicitudes" ADD "altitud_origen" character varying(10)`);
        await queryRunner.query(`ALTER TABLE "solicitudes" ADD "ubicacion_simulada" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "solicitudes" ADD "ubicacion_exacta" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(
            `ALTER TABLE "solicitudes" ADD CONSTRAINT "CHK_solicitudes_altitud_origen" CHECK ("altitud_origen" IN ('servicio', 'gps'))`,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_solicitudes_mapa_estado_fecha" ON "solicitudes" ("estado", "fecha" DESC) WHERE "latitud" IS NOT NULL AND "longitud" IS NOT NULL`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_solicitudes_mapa_estado_fecha"`);
        await queryRunner.query(`ALTER TABLE "solicitudes" DROP CONSTRAINT "CHK_solicitudes_altitud_origen"`);
        await queryRunner.query(`ALTER TABLE "solicitudes" DROP COLUMN "ubicacion_exacta"`);
        await queryRunner.query(`ALTER TABLE "solicitudes" DROP COLUMN "ubicacion_simulada"`);
        await queryRunner.query(`ALTER TABLE "solicitudes" DROP COLUMN "altitud_origen"`);
        await queryRunner.query(`ALTER TABLE "solicitudes" DROP COLUMN "altitud_msnm"`);
    }
}
