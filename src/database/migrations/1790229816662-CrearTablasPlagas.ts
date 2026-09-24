import { MigrationInterface, QueryRunner } from "typeorm";

export class CrearTablasPlagas1790229816662 implements MigrationInterface {
    name = "CrearTablasPlagas1790229816662";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE "sinonimos_plaga" ("id" uuid NOT NULL, "plaga_id" uuid NOT NULL, "sinonimo" character varying(150) NOT NULL, CONSTRAINT "UQ_8c2d7df4d8240515f53795dc247" UNIQUE ("plaga_id", "sinonimo"), CONSTRAINT "PK_0674f94775b7f32df75ab9ea0d9" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `CREATE TABLE "plagas" ("id" uuid NOT NULL, "nombre_comun" character varying(150) NOT NULL, "nombre_cientifico" character varying(150), "tipo" character varying(20) NOT NULL, "descripcion" text NOT NULL, "sintomas" text NOT NULL, "cultivo" character varying(100) NOT NULL DEFAULT 'cafe', "organos_afectados" text array NOT NULL, "hospederos" text array NOT NULL DEFAULT '{}', "medidas_contencion" text NOT NULL, "protocolo_quimico" text, "foto_url" text, CONSTRAINT "UQ_4398f40510326ce8afdcb6397ae" UNIQUE ("nombre_cientifico"), CONSTRAINT "PK_64f4645c6e3468acac486962919" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(`CREATE INDEX "IDX_f7ae08e7543c400a66bddb30f1" ON "plagas"  ("nombre_comun") `);
        await queryRunner.query(`CREATE INDEX "IDX_8f0d572dcef5e65cb0a1423e13" ON "plagas"  ("tipo") `);
        await queryRunner.query(
            `CREATE TABLE "avales_plaga" ("id" uuid NOT NULL, "plaga_id" uuid NOT NULL, "agronomo_id" uuid NOT NULL, "numero_tarjeta" character varying(50) NOT NULL, "fecha_aval" TIMESTAMP NOT NULL, CONSTRAINT "UQ_7a5a33a2f386f705494a51c65d7" UNIQUE ("plaga_id", "agronomo_id"), CONSTRAINT "PK_3d3d5734b1f4ee6c8109b6b5565" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `ALTER TABLE "sinonimos_plaga" ADD CONSTRAINT "FK_43131b8f5f2fcfd32a17bbf0710" FOREIGN KEY ("plaga_id") REFERENCES "plagas"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "avales_plaga" ADD CONSTRAINT "FK_4c5668407c4daff9593345ff3a8" FOREIGN KEY ("plaga_id") REFERENCES "plagas"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "avales_plaga" ADD CONSTRAINT "FK_f8ea22ee80f71d86fe0b338e493" FOREIGN KEY ("agronomo_id") REFERENCES "agronomos"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "avales_plaga" DROP CONSTRAINT "FK_f8ea22ee80f71d86fe0b338e493"`);
        await queryRunner.query(`ALTER TABLE "avales_plaga" DROP CONSTRAINT "FK_4c5668407c4daff9593345ff3a8"`);
        await queryRunner.query(`ALTER TABLE "sinonimos_plaga" DROP CONSTRAINT "FK_43131b8f5f2fcfd32a17bbf0710"`);
        await queryRunner.query(`DROP TABLE "avales_plaga"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8f0d572dcef5e65cb0a1423e13"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f7ae08e7543c400a66bddb30f1"`);
        await queryRunner.query(`DROP TABLE "plagas"`);
        await queryRunner.query(`DROP TABLE "sinonimos_plaga"`);
    }
}
