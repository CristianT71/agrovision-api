import { MigrationInterface, QueryRunner } from "typeorm";
import { sembrarReglasZona } from "../../modules/reglas-zona/infrastructure/adapters/out/persistence/semillas-reglas-zona";

/**
 * Lleva las semillas de reglas de zona (4 enfermedades y 2 plagas, v1 en BORRADOR con valores de EJEMPLO) a las
 * bases que ya habían ejecutado CrearReglasZona cuando solo sembraba la roya: TypeORM no vuelve a correr una
 * migración ya registrada.
 *
 * - Idempotente: solo siembra los tipos que aún no tienen ninguna regla; no toca reglas ni filas existentes.
 * - En una base nueva no hace nada, porque CrearReglasZona ya sembró los seis tipos.
 */
export class SembrarReglasZonaPendientes1793700000000 implements MigrationInterface {
    name = "SembrarReglasZonaPendientes1793700000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await sembrarReglasZona((sql, parametros) => queryRunner.query(sql, parametros));
    }

    public async down(): Promise<void> {
        // Sin efecto a propósito: no se distingue una semilla de esta migración de una ya editada o aprobada por un
        // agrónomo, y borrarla perdería ese trabajo. Las reglas se retiran desde el panel (borrador) o se archivan.
    }
}
