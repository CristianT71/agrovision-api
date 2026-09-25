import { MigrationInterface, QueryRunner } from "typeorm";

export class CrearTablaNotificaciones1790298053808 implements MigrationInterface {
    name = 'CrearTablaNotificaciones1790298053808'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "notificaciones" ("id" uuid NOT NULL, "usuario_id" uuid NOT NULL, "tipo" character varying(30) NOT NULL, "titulo" character varying(150) NOT NULL, "descripcion" character varying(500) NOT NULL, "referencia_tipo" character varying(20), "referencia_id" uuid, "leida" boolean NOT NULL DEFAULT false, "fecha" TIMESTAMP NOT NULL, CONSTRAINT "PK_a9d32a419ff58b53a38b5ef85d4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_85268c520cd13f2372c032581f" ON "notificaciones"  ("usuario_id", "fecha") `);
        await queryRunner.query(`CREATE INDEX "IDX_781d141f2993139cb6edaf9ebb" ON "notificaciones"  ("usuario_id", "leida") `);
        await queryRunner.query(`CREATE INDEX "IDX_cda59b99657b685e77a663ec33" ON "adjuntos_mensaje"  ("mensaje_id") `);
        await queryRunner.query(`ALTER TABLE "notificaciones" ADD CONSTRAINT "FK_2c6341d5bd206ff522b35aa6b69" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notificaciones" DROP CONSTRAINT "FK_2c6341d5bd206ff522b35aa6b69"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cda59b99657b685e77a663ec33"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_781d141f2993139cb6edaf9ebb"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_85268c520cd13f2372c032581f"`);
        await queryRunner.query(`DROP TABLE "notificaciones"`);
    }

}
