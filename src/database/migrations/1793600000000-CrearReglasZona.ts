import { MigrationInterface, QueryRunner } from "typeorm";
import { sembrarReglasZona } from "../../modules/reglas-zona/infrastructure/adapters/out/persistence/semillas-reglas-zona";

// Reglas de zona de vigilancia: tabla versionada de criterio experto (severidad %, incidencia %) → radio en metros
// alrededor de un foco. No existe una fórmula científica %hoja→metros: la define un agrónomo y se muestra como
// "estimación sin calibrar" mientras no la marque calibrada con una nota.

// Semilla: una regla v1 en BORRADOR por cada tipo (4 enfermedades y 2 plagas) con valores de EJEMPLO.
// Las funciones viven fuera de este directorio: TypeORM trataría cualquier función exportada aquí como migración.

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

        // Semilla: 4 enfermedades y 2 plagas, cada una v1 en BORRADOR con valores de EJEMPLO.
        await sembrarReglasZona((sql, parametros) => queryRunner.query(sql, parametros));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // La auditoría es un historial inmutable: los triggers frenan UPDATE/DELETE/TRUNCATE pero no DROP TABLE.
        // Por eso el revert se niega si hay historial; para revertir hay que respaldarlo y vaciarlo a mano antes.
        const [{ total }] = (await queryRunner.query(`SELECT COUNT(*)::int AS total FROM "auditoria_reglas_zona"`)) as {
            total: number;
        }[];
        if (Number(total) > 0) {
            throw new Error(
                `No se revierte CrearReglasZona: auditoria_reglas_zona tiene ${total} registro(s) de historial que se perderían. ` +
                    "Respáldalos y retíralos manualmente antes de revertir.",
            );
        }
        // Las reglas sembradas (y sus filas) desaparecen con sus tablas.
        // Al borrar la tabla se van sus triggers e índices; la función se quita aparte
        await queryRunner.query(`DROP TABLE "auditoria_reglas_zona"`);
        await queryRunner.query(`DROP FUNCTION "impedir_cambios_auditoria_reglas_zona"()`);
        await queryRunner.query(`DROP TABLE "reglas_zona_filas"`);
        await queryRunner.query(`DROP TABLE "reglas_zona"`);
    }
}
