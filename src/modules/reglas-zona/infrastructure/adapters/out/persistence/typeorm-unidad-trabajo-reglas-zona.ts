import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import type { IUnidadTrabajoReglasZona, TransaccionReglasZona } from "../../../../domain/ports/out/unidad-trabajo.port";
import { TypeOrmReglasZonaRepository } from "./typeorm-reglas-zona.repository";
import { TypeOrmAuditoriaReglasZonaAdapter } from "./typeorm-auditoria-reglas-zona.adapter";

// Repositorio y auditoría comparten el EntityManager de una transacción: si cualquiera falla, se revierte todo.
@Injectable()
export class TypeOrmUnidadTrabajoReglasZona implements IUnidadTrabajoReglasZona {
    constructor(private readonly db: DataSource) {}

    ejecutar<T>(trabajo: (tx: TransaccionReglasZona) => Promise<T>): Promise<T> {
        return this.db.transaction((gestor) =>
            trabajo({
                reglas: new TypeOrmReglasZonaRepository(gestor),
                auditoria: new TypeOrmAuditoriaReglasZonaAdapter(gestor),
            }),
        );
    }
}
