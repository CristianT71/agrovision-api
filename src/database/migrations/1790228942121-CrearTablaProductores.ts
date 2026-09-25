import { MigrationInterface, QueryRunner } from "typeorm";

export class CrearTablaProductores1790228942121 implements MigrationInterface {
    name = "CrearTablaProductores1790228942121";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE "productores" ("id" uuid NOT NULL, "usuario_id" uuid NOT NULL, "nombre" character varying(150) NOT NULL, "finca" character varying(150) NOT NULL, "vereda" character varying(100) NOT NULL, "municipio" character varying(100) NOT NULL, "telefono" character varying(20) NOT NULL, "estado" character varying(20) NOT NULL DEFAULT 'registrado', "consentimiento" boolean NOT NULL DEFAULT false, "fecha_consentimiento" TIMESTAMP, CONSTRAINT "UQ_2473bbf810e5c26794cc1942e57" UNIQUE ("usuario_id"), CONSTRAINT "UQ_04d45f2997d5132bb380134eb15" UNIQUE ("telefono"), CONSTRAINT "REL_2473bbf810e5c26794cc1942e5" UNIQUE ("usuario_id"), CONSTRAINT "PK_1d3f414ea3d64f4132702af97c0" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(`CREATE INDEX "IDX_6966ccfbc8d5bb81980a521ebd" ON "productores"  ("nombre") `);
        await queryRunner.query(`CREATE INDEX "IDX_6859167c79a96c6d6cdb4f662a" ON "productores"  ("municipio") `);
        await queryRunner.query(
            `ALTER TABLE "productores" ADD CONSTRAINT "FK_2473bbf810e5c26794cc1942e57" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "productores" DROP CONSTRAINT "FK_2473bbf810e5c26794cc1942e57"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6859167c79a96c6d6cdb4f662a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6966ccfbc8d5bb81980a521ebd"`);
        await queryRunner.query(`DROP TABLE "productores"`);
    }
}
