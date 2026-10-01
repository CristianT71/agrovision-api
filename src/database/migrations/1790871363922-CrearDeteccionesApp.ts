import { MigrationInterface, QueryRunner } from "typeorm";

export class CrearDeteccionesApp1790871363922 implements MigrationInterface {
    name = "CrearDeteccionesApp1790871363922";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE "detecciones_app" ("id" uuid NOT NULL, "id_cliente" uuid NOT NULL, "productor_id" uuid NOT NULL, "tipo" character varying(20) NOT NULL, "clase_predicha" character varying(100), "confianza" real, "puntaje_ood" real NOT NULL, "resultado_compuerta" character varying(20) NOT NULL, "modelo_id" uuid, "modelo_version" character varying(30) NOT NULL, "correccion_productor" character varying(100), "confirmada_productor" boolean NOT NULL DEFAULT false, "cultivo" character varying(20), "organo" character varying(20), "latitud" double precision, "longitud" double precision, "precision_metros" real, "embedding" text, "municipio" character varying(100) NOT NULL, "fecha" TIMESTAMP NOT NULL, "recibida_en" TIMESTAMP WITH TIME ZONE NOT NULL, "defectuosa" boolean NOT NULL DEFAULT false, CONSTRAINT "UQ_d33205390d2a9bfc398b623aff2" UNIQUE ("id_cliente"), CONSTRAINT "PK_cbeb9907cf873265250e96cba05" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(`CREATE INDEX "IDX_f1ebb94cbca1de1afff9519006" ON "detecciones_app" ("productor_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_7e08efdfea0e751fcfe0caa927" ON "detecciones_app" ("tipo") `);
        await queryRunner.query(`CREATE INDEX "IDX_8ec70ebd6e446639bb27372d41" ON "detecciones_app" ("modelo_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_d32043a04297baa909eddc72ac" ON "detecciones_app" ("fecha") `);
        await queryRunner.query(
            `ALTER TABLE "detecciones_app" ADD CONSTRAINT "FK_f1ebb94cbca1de1afff9519006c" FOREIGN KEY ("productor_id") REFERENCES "productores"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "detecciones_app" ADD CONSTRAINT "FK_8ec70ebd6e446639bb27372d414" FOREIGN KEY ("modelo_id") REFERENCES "modelos_ia"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "detecciones_app" DROP CONSTRAINT "FK_8ec70ebd6e446639bb27372d414"`);
        await queryRunner.query(`ALTER TABLE "detecciones_app" DROP CONSTRAINT "FK_f1ebb94cbca1de1afff9519006c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d32043a04297baa909eddc72ac"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8ec70ebd6e446639bb27372d41"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7e08efdfea0e751fcfe0caa927"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f1ebb94cbca1de1afff9519006"`);
        await queryRunner.query(`DROP TABLE "detecciones_app"`);
    }
}
