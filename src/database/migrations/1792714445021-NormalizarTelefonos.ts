import { MigrationInterface, QueryRunner } from "typeorm";

// RF-01.3: desde ahora el teléfono se guarda siempre en E.164 ("+573001234567"). Los que se
// registraron sin el "+" ("573001234567") no se encontrarían al iniciar sesión.
// Solo se toca lo que sin duda es un celular de un país admitido, y nunca si ya existe la versión con "+"
// (la columna es única): esos casos hay que resolverlos a mano.
const CELULAR_SIN_MAS = "^(57[0-9]{10}|1[0-9]{10}|52[0-9]{10}|51[0-9]{9}|593[0-9]{9})$";

export class NormalizarTelefonos1792714445021 implements MigrationInterface {
    name = "NormalizarTelefonos1792714445021";

    public async up(queryRunner: QueryRunner): Promise<void> {
        for (const tabla of ["usuarios", "productores", "agronomos"]) {
            await queryRunner.query(
                `UPDATE "${tabla}" t SET "telefono" = '+' || t."telefono" WHERE t."telefono" ~ '${CELULAR_SIN_MAS}' AND NOT EXISTS (SELECT 1 FROM "${tabla}" x WHERE x."telefono" = '+' || t."telefono")`,
            );
        }
    }

    public async down(): Promise<void> {
        // No hay vuelta atrás: no se sabe qué teléfonos venían sin "+" y quitárselo a todos rompería los demás
    }
}
