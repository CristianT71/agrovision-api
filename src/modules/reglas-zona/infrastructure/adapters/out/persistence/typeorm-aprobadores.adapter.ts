import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import type { Aprobador } from "../../../../domain/entities/regla-zona";
import type { IAprobadoresReglasZona } from "../../../../domain/ports/out/aprobadores.port";

// Lectura directa de la tabla de agrónomos (sin acoplarse al módulo agronomos): solo nombre y tarjeta
// de una cuenta validada (estado 'activo').
@Injectable()
export class TypeOrmAprobadoresAdapter implements IAprobadoresReglasZona {
    constructor(private readonly db: DataSource) {}

    async agronomoValidado(usuarioId: string): Promise<Aprobador | null> {
        const filas = await this.db.query<{ nombre: string; tarjeta_profesional: string }[]>(
            `SELECT a.nombre, a.tarjeta_profesional FROM agronomos a JOIN usuarios u ON u.id = a.usuario_id
             WHERE a.usuario_id=$1 AND a.estado='activo' AND u.rol='agronomo' AND u.estado='activo'`,
            [usuarioId],
        );
        const fila = filas[0];
        return fila ? { nombre: fila.nombre, tarjetaProfesional: fila.tarjeta_profesional } : null;
    }
}
