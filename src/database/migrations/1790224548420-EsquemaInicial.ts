import { MigrationInterface, QueryRunner } from "typeorm";

export class EsquemaInicial1790224548420 implements MigrationInterface {
    name = "EsquemaInicial1790224548420";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE "usuarios" ("id" uuid NOT NULL, "telefono" character varying(20) NOT NULL, "rol" character varying(20) NOT NULL DEFAULT 'productor', "estado" character varying(20) NOT NULL DEFAULT 'activo', "fecha_registro" TIMESTAMP NOT NULL, CONSTRAINT "UQ_f1a10a95cdf943d69b50ba909b7" UNIQUE ("telefono"), CONSTRAINT "PK_d7281c63c176e152e4c531594a8" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `CREATE TABLE "agronomos" ("id" uuid NOT NULL, "usuario_id" uuid NOT NULL, "nombre" character varying(150) NOT NULL, "tarjeta_profesional" character varying(50) NOT NULL, "telefono" character varying(20) NOT NULL, "correo" character varying(150) NOT NULL, "especialidad" character varying(100) NOT NULL, "estado" character varying(20) NOT NULL DEFAULT 'pendiente', "fecha_alta" TIMESTAMP NOT NULL, CONSTRAINT "UQ_54f72b2951603c310d3a631ae36" UNIQUE ("usuario_id"), CONSTRAINT "UQ_d719a822036019a4b94f13411b2" UNIQUE ("tarjeta_profesional"), CONSTRAINT "UQ_57d70d6bdcce6a119b8578f1ead" UNIQUE ("telefono"), CONSTRAINT "UQ_a21cc99edfa65e4df74c9a67ab6" UNIQUE ("correo"), CONSTRAINT "REL_54f72b2951603c310d3a631ae3" UNIQUE ("usuario_id"), CONSTRAINT "PK_c86eee843ef7853a113f0cfecab" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `CREATE TABLE "sesiones_otp" ("id" uuid NOT NULL, "usuario_id" uuid NOT NULL, "codigo" character varying(6) NOT NULL, "expira_en" TIMESTAMP NOT NULL, "usado" boolean NOT NULL DEFAULT false, "creado_en" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_09c70da51854c1fd5f1af85be5d" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `CREATE TABLE "solicitudes" ("id" uuid NOT NULL, "productor_id" uuid NOT NULL, "agronomo_id" uuid, "estado" character varying(50) NOT NULL, "fecha" TIMESTAMP NOT NULL, "municipio" character varying(100) NOT NULL, "vereda" character varying(100) NOT NULL, "finca" character varying(100) NOT NULL, "confianza_ia" double precision NOT NULL, "modelo_version_id" uuid NOT NULL, "respuesta_profesional" text, "tipo_resultado" character varying(100), CONSTRAINT "PK_8c7e99758c774b801853b538647" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `ALTER TABLE "agronomos" ADD CONSTRAINT "FK_54f72b2951603c310d3a631ae36" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "agronomos" DROP CONSTRAINT "FK_54f72b2951603c310d3a631ae36"`);
        await queryRunner.query(`DROP TABLE "solicitudes"`);
        await queryRunner.query(`DROP TABLE "sesiones_otp"`);
        await queryRunner.query(`DROP TABLE "agronomos"`);
        await queryRunner.query(`DROP TABLE "usuarios"`);
    }
}
