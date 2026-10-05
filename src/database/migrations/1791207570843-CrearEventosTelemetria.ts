import { MigrationInterface, QueryRunner } from "typeorm";

export class CrearEventosTelemetria1791207570843 implements MigrationInterface {
    name = "CrearEventosTelemetria1791207570843";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE "eventos_telemetria" ("id" uuid NOT NULL, "tipo" character varying(20) NOT NULL, "instalacion_id" character varying(64), "version_app" character varying(20), "version_modelo" character varying(30), "resultado" character varying(30), "confianza" real, "latencia_ms" integer, "delegado" character varying(20), "clase_origen" character varying(100), "clase_destino" character varying(100), "version_origen" character varying(30), "version_destino" character varying(30), "exito" boolean, "ocurrido_en" TIMESTAMP WITH TIME ZONE NOT NULL, "recibido_en" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_703cd7c772b280092991cd47180" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_3190ab91686b91e47bd79b01bf" ON "eventos_telemetria"  ("version_modelo", "ocurrido_en") `,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_7cfb5165a9319facad39d9e202" ON "eventos_telemetria"  ("tipo", "ocurrido_en") `,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "eventos_telemetria"`);
    }
}
