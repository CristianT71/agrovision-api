import { MigrationInterface, QueryRunner } from "typeorm";

// Notificaciones por correo: dirección opcional y preferencia de cada usuario (apagada por defecto)
export class AgregarCorreoUsuarios1792900000000 implements MigrationInterface {
    name = "AgregarCorreoUsuarios1792900000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "usuarios" ADD "correo" character varying(150)`);
        await queryRunner.query(`ALTER TABLE "usuarios" ADD "correo_notificaciones" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "usuarios" DROP COLUMN "correo_notificaciones"`);
        await queryRunner.query(`ALTER TABLE "usuarios" DROP COLUMN "correo"`);
    }
}
