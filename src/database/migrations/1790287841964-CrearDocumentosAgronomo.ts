import { MigrationInterface, QueryRunner } from "typeorm";

export class CrearDocumentosAgronomo1790287841964 implements MigrationInterface {
    name = "CrearDocumentosAgronomo1790287841964";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE "documentos_agronomo" ("id" uuid NOT NULL, "agronomo_id" uuid NOT NULL, "ruta" character varying(255) NOT NULL, "nombre_original" character varying(255) NOT NULL, "tipo_mime" character varying(100) NOT NULL, "tamano_bytes" integer NOT NULL, "fecha_subida" TIMESTAMP NOT NULL, CONSTRAINT "PK_94c14d9a22de41d7ec67cba05c5" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_7fe039430ecca7038980c915ee" ON "documentos_agronomo" ("agronomo_id") `,
        );
        await queryRunner.query(
            `ALTER TABLE "documentos_agronomo" ADD CONSTRAINT "FK_7fe039430ecca7038980c915eee" FOREIGN KEY ("agronomo_id") REFERENCES "agronomos"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
        );
        // Desde ahora la cuenta de login refleja el estado del agrónomo (pendiente/activo/inactivo)
        await queryRunner.query(
            `UPDATE "usuarios" SET "estado" = "agronomos"."estado" FROM "agronomos" WHERE "agronomos"."usuario_id" = "usuarios"."id"`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "documentos_agronomo" DROP CONSTRAINT "FK_7fe039430ecca7038980c915eee"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7fe039430ecca7038980c915ee"`);
        await queryRunner.query(`DROP TABLE "documentos_agronomo"`);
    }
}
