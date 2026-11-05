import { MigrationInterface, QueryRunner } from "typeorm";

// Ajustes del panel: preferencias por cuenta (idioma, zona horaria, avisos) y una fila global del sistema.
// Se guardan como jsonb: solo lo que se cambió; lo demás sale de los valores por defecto del dominio.
export class CrearTablasAjustes1793300000000 implements MigrationInterface {
    name = "CrearTablasAjustes1793300000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE "ajustes_usuario" ("usuario_id" uuid NOT NULL, "datos" jsonb NOT NULL DEFAULT '{}', "fecha_actualizacion" TIMESTAMP NOT NULL, CONSTRAINT "PK_ajustes_usuario" PRIMARY KEY ("usuario_id"))`,
        );
        await queryRunner.query(
            `ALTER TABLE "ajustes_usuario" ADD CONSTRAINT "FK_ajustes_usuario_usuario" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `CREATE TABLE "ajustes_sistema" ("id" smallint NOT NULL, "datos" jsonb NOT NULL DEFAULT '{}', "actualizado_por" uuid, "fecha_actualizacion" TIMESTAMP NOT NULL, CONSTRAINT "PK_ajustes_sistema" PRIMARY KEY ("id"), CONSTRAINT "CHK_ajustes_sistema_unica" CHECK ("id" = 1))`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "ajustes_sistema"`);
        await queryRunner.query(`ALTER TABLE "ajustes_usuario" DROP CONSTRAINT "FK_ajustes_usuario_usuario"`);
        await queryRunner.query(`DROP TABLE "ajustes_usuario"`);
    }
}
