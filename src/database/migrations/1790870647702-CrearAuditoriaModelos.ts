import { MigrationInterface, QueryRunner } from "typeorm";

export class CrearAuditoriaModelos1790870647702 implements MigrationInterface {
    name = "CrearAuditoriaModelos1790870647702";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE "auditoria_modelos" ("id" uuid NOT NULL, "modelo_id" uuid NOT NULL, "accion" character varying(30) NOT NULL, "actor_usuario_id" uuid NOT NULL, "motivo" text, "detalle" jsonb, "fecha" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_2b5ac124bb6c27fdd8c67d2130e" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_bbc6a0df5740a16c9775df1a52" ON "auditoria_modelos" ("modelo_id", "fecha") `,
        );
        await queryRunner.query(
            `ALTER TABLE "auditoria_modelos" ADD CONSTRAINT "FK_2b092d10a6b0e05cb5c6e026202" FOREIGN KEY ("modelo_id") REFERENCES "modelos_ia"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "auditoria_modelos" ADD CONSTRAINT "FK_e16f63cfb387cb64001b2d0174f" FOREIGN KEY ("actor_usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
        );

        // RF-09.4 / RNF-01.2: el log es de solo inserción. Ni la API ni nadie con acceso a la base
        // puede corregir o borrar un evento auditado sin quitar antes este trigger.
        await queryRunner.query(
            `CREATE FUNCTION "impedir_cambios_auditoria_modelos"() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'El registro de auditoría de modelos es inmutable'; END; $$ LANGUAGE plpgsql`,
        );
        await queryRunner.query(
            `CREATE TRIGGER "auditoria_modelos_inmutable" BEFORE UPDATE OR DELETE ON "auditoria_modelos" FOR EACH ROW EXECUTE FUNCTION "impedir_cambios_auditoria_modelos"()`,
        );
        await queryRunner.query(
            `CREATE TRIGGER "auditoria_modelos_sin_truncate" BEFORE TRUNCATE ON "auditoria_modelos" FOR EACH STATEMENT EXECUTE FUNCTION "impedir_cambios_auditoria_modelos"()`,
        );

        // RF-09.5: un solo canario y una sola producción vigentes
        await queryRunner.query(
            `CREATE UNIQUE INDEX "UQ_modelos_ia_canal_canario" ON "modelos_ia" ("canal") WHERE "canal" = 'canario'`,
        );
        await queryRunner.query(
            `CREATE UNIQUE INDEX "UQ_modelos_ia_canal_produccion" ON "modelos_ia" ("canal") WHERE "canal" = 'produccion'`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."UQ_modelos_ia_canal_produccion"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_modelos_ia_canal_canario"`);
        // Al borrar la tabla se van sus triggers; la función se quita aparte
        await queryRunner.query(`ALTER TABLE "auditoria_modelos" DROP CONSTRAINT "FK_e16f63cfb387cb64001b2d0174f"`);
        await queryRunner.query(`ALTER TABLE "auditoria_modelos" DROP CONSTRAINT "FK_2b092d10a6b0e05cb5c6e026202"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bbc6a0df5740a16c9775df1a52"`);
        await queryRunner.query(`DROP TABLE "auditoria_modelos"`);
        await queryRunner.query(`DROP FUNCTION "impedir_cambios_auditoria_modelos"()`);
    }
}
