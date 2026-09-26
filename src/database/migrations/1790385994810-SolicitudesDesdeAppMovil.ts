import { MigrationInterface, QueryRunner } from "typeorm";

export class SolicitudesDesdeAppMovil1790385994810 implements MigrationInterface {
    name = "SolicitudesDesdeAppMovil1790385994810";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE "fotos_solicitud" ("id" uuid NOT NULL, "solicitud_id" uuid NOT NULL, "id_cliente" uuid NOT NULL, "angulo" character varying(20) NOT NULL, "orden" smallint NOT NULL, "ruta" text, "tipo_mime" character varying(100), "tamano_bytes" integer, "subida_en" TIMESTAMP, CONSTRAINT "UQ_7d2d3f813b9776ed66a708c9423" UNIQUE ("id_cliente"), CONSTRAINT "UQ_0f5bc93010c5a459a6ce9a805c0" UNIQUE ("solicitud_id", "orden"), CONSTRAINT "PK_08a8393bf039d500a1819e1d8bd" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_569a387b657277436c3107fd2c" ON "fotos_solicitud"  ("solicitud_id") `,
        );
        await queryRunner.query(`ALTER TABLE "solicitudes" ADD "id_cliente" uuid`);
        await queryRunner.query(
            `ALTER TABLE "solicitudes" ADD CONSTRAINT "UQ_8f6f2a39262163a0ef9ecb06526" UNIQUE ("id_cliente")`,
        );
        await queryRunner.query(`ALTER TABLE "solicitudes" ADD "captura_id" uuid`);
        await queryRunner.query(`ALTER TABLE "solicitudes" ADD "cultivo" character varying(20)`);
        await queryRunner.query(`ALTER TABLE "solicitudes" ADD "organo" character varying(20)`);
        await queryRunner.query(`ALTER TABLE "solicitudes" ADD "nota" character varying(500)`);
        await queryRunner.query(`ALTER TABLE "solicitudes" ADD "latitud" double precision`);
        await queryRunner.query(`ALTER TABLE "solicitudes" ADD "longitud" double precision`);
        await queryRunner.query(`ALTER TABLE "solicitudes" ADD "precision_metros" real`);
        await queryRunner.query(
            `ALTER TABLE "solicitudes" ADD "actualizado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
        );
        await queryRunner.query(`ALTER TABLE "solicitudes" ALTER COLUMN "confianza_ia" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "solicitudes" ALTER COLUMN "modelo_version_id" DROP NOT NULL`);
        await queryRunner.query(
            `ALTER TABLE "fotos_solicitud" ADD CONSTRAINT "FK_569a387b657277436c3107fd2cb" FOREIGN KEY ("solicitud_id") REFERENCES "solicitudes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "fotos_solicitud" DROP CONSTRAINT "FK_569a387b657277436c3107fd2cb"`);
        // ATENCIÓN: este revert falla si ya existen solicitudes creadas desde la app móvil, porque
        // se guardan con confianza_ia (y modelo_version_id) en null y SET NOT NULL no las admite.
        // Antes de revertir hay que completar esos valores o eliminar esas solicitudes.
        await queryRunner.query(`ALTER TABLE "solicitudes" ALTER COLUMN "modelo_version_id" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "solicitudes" ALTER COLUMN "confianza_ia" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "solicitudes" DROP COLUMN "actualizado_en"`);
        await queryRunner.query(`ALTER TABLE "solicitudes" DROP COLUMN "precision_metros"`);
        await queryRunner.query(`ALTER TABLE "solicitudes" DROP COLUMN "longitud"`);
        await queryRunner.query(`ALTER TABLE "solicitudes" DROP COLUMN "latitud"`);
        await queryRunner.query(`ALTER TABLE "solicitudes" DROP COLUMN "nota"`);
        await queryRunner.query(`ALTER TABLE "solicitudes" DROP COLUMN "organo"`);
        await queryRunner.query(`ALTER TABLE "solicitudes" DROP COLUMN "cultivo"`);
        await queryRunner.query(`ALTER TABLE "solicitudes" DROP COLUMN "captura_id"`);
        await queryRunner.query(`ALTER TABLE "solicitudes" DROP CONSTRAINT "UQ_8f6f2a39262163a0ef9ecb06526"`);
        await queryRunner.query(`ALTER TABLE "solicitudes" DROP COLUMN "id_cliente"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_569a387b657277436c3107fd2c"`);
        await queryRunner.query(`DROP TABLE "fotos_solicitud"`);
    }
}
