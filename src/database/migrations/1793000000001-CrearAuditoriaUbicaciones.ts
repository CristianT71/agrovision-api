import { MigrationInterface, QueryRunner } from "typeorm";

// Quién consultó la ubicación exacta de un cultivo, cuál y cuándo (RNF-01.2). Mismo patrón de solo inserción
// que auditoria_modelos. No lleva FK a solicitudes: el rastro debe sobrevivir aunque la solicitud cambie.
export class CrearAuditoriaUbicaciones1793000000001 implements MigrationInterface {
    name = "CrearAuditoriaUbicaciones1793000000001";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE "auditoria_ubicaciones" ("id" uuid NOT NULL, "accion" character varying(30) NOT NULL, "actor_usuario_id" uuid NOT NULL, "solicitud_id" uuid, "filtros" jsonb, "resultados" integer, "fecha" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_auditoria_ubicaciones" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_auditoria_ubicaciones_solicitud_fecha" ON "auditoria_ubicaciones" ("solicitud_id", "fecha")`,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_auditoria_ubicaciones_actor_fecha" ON "auditoria_ubicaciones" ("actor_usuario_id", "fecha")`,
        );
        await queryRunner.query(
            `ALTER TABLE "auditoria_ubicaciones" ADD CONSTRAINT "FK_auditoria_ubicaciones_actor" FOREIGN KEY ("actor_usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `CREATE FUNCTION "impedir_cambios_auditoria_ubicaciones"() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'El registro de auditoría de ubicaciones es inmutable'; END; $$ LANGUAGE plpgsql`,
        );
        await queryRunner.query(
            `CREATE TRIGGER "auditoria_ubicaciones_inmutable" BEFORE UPDATE OR DELETE ON "auditoria_ubicaciones" FOR EACH ROW EXECUTE FUNCTION "impedir_cambios_auditoria_ubicaciones"()`,
        );
        await queryRunner.query(
            `CREATE TRIGGER "auditoria_ubicaciones_sin_truncate" BEFORE TRUNCATE ON "auditoria_ubicaciones" FOR EACH STATEMENT EXECUTE FUNCTION "impedir_cambios_auditoria_ubicaciones"()`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Al borrar la tabla se van sus triggers; la función se quita aparte
        await queryRunner.query(`ALTER TABLE "auditoria_ubicaciones" DROP CONSTRAINT "FK_auditoria_ubicaciones_actor"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_auditoria_ubicaciones_actor_fecha"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_auditoria_ubicaciones_solicitud_fecha"`);
        await queryRunner.query(`DROP TABLE "auditoria_ubicaciones"`);
        await queryRunner.query(`DROP FUNCTION "impedir_cambios_auditoria_ubicaciones"()`);
    }
}
