import { MigrationInterface, QueryRunner } from "typeorm";

// Reglas de zona de vigilancia: tabla versionada de criterio experto (severidad %, incidencia %) → radio en metros
// alrededor de un foco. No existe una fórmula científica %hoja→metros: la define un agrónomo y se muestra como
// "estimación sin calibrar" mientras no la marque calibrada con una nota.
export const ID_SEMILLA_ROYA_V1 = "6f1c2a52-8d0e-4c1b-9a7e-3b5d0c9e7a01";

export class CrearReglasZona1793600000000 implements MigrationInterface {
    name = "CrearReglasZona1793600000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "reglas_zona" (
            "id" uuid NOT NULL,
            "tipo_enfermedad" character varying(50) NOT NULL,
            "version" integer NOT NULL,
            "estado" character varying(20) NOT NULL DEFAULT 'borrador',
            "calibrada" boolean NOT NULL DEFAULT false,
            "notas" text,
            "creada_por" uuid,
            "creada_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            "aprobada_por_usuario_id" uuid,
            "aprobada_por_nombre" character varying(150),
            "aprobada_por_tarjeta" character varying(50),
            "aprobada_en" TIMESTAMP WITH TIME ZONE,
            "activada_en" TIMESTAMP WITH TIME ZONE,
            "archivada_en" TIMESTAMP WITH TIME ZONE,
            CONSTRAINT "PK_reglas_zona" PRIMARY KEY ("id"),
            CONSTRAINT "UQ_reglas_zona_tipo_version" UNIQUE ("tipo_enfermedad", "version"),
            CONSTRAINT "CHK_reglas_zona_version" CHECK ("version" >= 1),
            CONSTRAINT "CHK_reglas_zona_estado" CHECK ("estado" IN ('borrador','aprobada','activa','archivada')),
            CONSTRAINT "CHK_reglas_zona_aprobacion" CHECK ("estado" = 'borrador' OR ("aprobada_por_nombre" IS NOT NULL AND "aprobada_por_tarjeta" IS NOT NULL AND "aprobada_en" IS NOT NULL)),
            CONSTRAINT "CHK_reglas_zona_calibrada" CHECK ("calibrada" = false OR "estado" <> 'borrador'),
            CONSTRAINT "FK_reglas_zona_creada_por" FOREIGN KEY ("creada_por") REFERENCES "usuarios"("id") ON DELETE SET NULL,
            CONSTRAINT "FK_reglas_zona_aprobada_por" FOREIGN KEY ("aprobada_por_usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL
        )`);
        // Una sola regla activa por tipo de enfermedad.
        await queryRunner.query(
            `CREATE UNIQUE INDEX "UQ_reglas_zona_activa_por_tipo" ON "reglas_zona" ("tipo_enfermedad") WHERE "estado" = 'activa'`,
        );
        await queryRunner.query(`CREATE TABLE "reglas_zona_filas" (
            "regla_id" uuid NOT NULL,
            "orden" smallint NOT NULL,
            "sev_max" double precision NOT NULL,
            "inc_max" double precision NOT NULL,
            "radio_min_m" double precision NOT NULL,
            "radio_max_m" double precision NOT NULL,
            CONSTRAINT "PK_reglas_zona_filas" PRIMARY KEY ("regla_id", "orden"),
            CONSTRAINT "CHK_reglas_zona_filas_orden" CHECK ("orden" BETWEEN 1 AND 12),
            CONSTRAINT "CHK_reglas_zona_filas_sev" CHECK ("sev_max" > 0 AND "sev_max" <= 100),
            CONSTRAINT "CHK_reglas_zona_filas_inc" CHECK ("inc_max" > 0 AND "inc_max" <= 100),
            CONSTRAINT "CHK_reglas_zona_filas_radios" CHECK ("radio_min_m" >= 0 AND "radio_max_m" <= 500 AND "radio_min_m" <= "radio_max_m"),
            CONSTRAINT "FK_reglas_zona_filas_regla" FOREIGN KEY ("regla_id") REFERENCES "reglas_zona"("id") ON DELETE CASCADE
        )`);

        // Mismo patrón de solo inserción que auditoria_vuelos. Sin FK a la regla: el rastro sobrevive al borrado.
        // Solo guarda ids, tipo, versión y estado: nunca nombre, tarjeta profesional ni notas.
        await queryRunner.query(`CREATE TABLE "auditoria_reglas_zona" (
            "id" uuid NOT NULL,
            "accion" character varying(20) NOT NULL,
            "actor_usuario_id" uuid NOT NULL,
            "regla_id" uuid NOT NULL,
            "detalle" jsonb,
            "fecha" TIMESTAMP WITH TIME ZONE NOT NULL,
            CONSTRAINT "PK_auditoria_reglas_zona" PRIMARY KEY ("id"),
            CONSTRAINT "FK_auditoria_reglas_zona_actor" FOREIGN KEY ("actor_usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT
        )`);
        await queryRunner.query(
            `CREATE INDEX "IDX_auditoria_reglas_zona_regla_fecha" ON "auditoria_reglas_zona" ("regla_id", "fecha")`,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_auditoria_reglas_zona_actor_fecha" ON "auditoria_reglas_zona" ("actor_usuario_id", "fecha")`,
        );
        await queryRunner.query(
            `CREATE FUNCTION "impedir_cambios_auditoria_reglas_zona"() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'El registro de auditoría de reglas de zona es inmutable'; END; $$ LANGUAGE plpgsql`,
        );
        await queryRunner.query(
            `CREATE TRIGGER "auditoria_reglas_zona_inmutable" BEFORE UPDATE OR DELETE ON "auditoria_reglas_zona" FOR EACH ROW EXECUTE FUNCTION "impedir_cambios_auditoria_reglas_zona"()`,
        );
        await queryRunner.query(
            `CREATE TRIGGER "auditoria_reglas_zona_sin_truncate" BEFORE TRUNCATE ON "auditoria_reglas_zona" FOR EACH STATEMENT EXECUTE FUNCTION "impedir_cambios_auditoria_reglas_zona"()`,
        );

        // Semilla: roya v1 en BORRADOR con valores de EJEMPLO. Un agrónomo debe revisarla, editarla y aprobarla.
        await queryRunner.query(
            `INSERT INTO "reglas_zona" ("id","tipo_enfermedad","version","estado","calibrada","notas","creada_por","creada_en")
             VALUES ($1,'roya',1,'borrador',false,$2,NULL,now())`,
            [
                ID_SEMILLA_ROYA_V1,
                "VALORES DE EJEMPLO, NO CALIBRADOS: tabla de muestra creada por la migración inicial para que el agrónomo " +
                    "la revise. No proviene de ningún estudio ni fórmula; la zona resultante es una estimación sin calibrar. " +
                    "Edítala o duplícala con el criterio experto antes de aprobarla.",
            ],
        );
        await queryRunner.query(
            `INSERT INTO "reglas_zona_filas" ("regla_id","orden","sev_max","inc_max","radio_min_m","radio_max_m") VALUES
             ($1,1,10,20,0,3),($1,2,30,40,3,8),($1,3,60,70,8,15),($1,4,100,100,15,30)`,
            [ID_SEMILLA_ROYA_V1],
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Al borrar la tabla se van sus triggers e índices; la función se quita aparte
        await queryRunner.query(`DROP TABLE "auditoria_reglas_zona"`);
        await queryRunner.query(`DROP FUNCTION "impedir_cambios_auditoria_reglas_zona"()`);
        await queryRunner.query(`DROP TABLE "reglas_zona_filas"`);
        await queryRunner.query(`DROP TABLE "reglas_zona"`);
    }
}
