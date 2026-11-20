import { MigrationInterface, QueryRunner } from "typeorm";
import { sembrarPropuestasV2 } from "../../modules/reglas-zona/infrastructure/adapters/out/persistence/semillas-reglas-zona-v2";

/**
 * Agrega una propuesta v2 en BORRADOR para roya y mancha de hierro, con los cortes de incidencia que sí tienen
 * fuente publicada y la fuente citada en las notas. Los radios siguen sin respaldo y nada nace calibrado ni activo.
 *
 * - Idempotente: no repite la propuesta si ya existe y no toca reglas ni filas existentes.
 * - Solo actúa sobre tipos que ya tienen alguna regla (la v1 sembrada).
 */
export class ProponerReglasZonaV21793900000000 implements MigrationInterface {
    name = "ProponerReglasZonaV21793900000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await sembrarPropuestasV2((sql, parametros) => queryRunner.query(sql, parametros));
    }

    public async down(): Promise<void> {
        // Sin efecto a propósito: la propuesta puede haber sido editada, aprobada o activada por un agrónomo y
        // borrarla perdería ese trabajo. Se retira desde el panel (borrador) o se archiva.
    }
}
