import { randomUUID } from "node:crypto";
import type { EntityManager } from "typeorm";
import type {
    IAuditoriaReglasZona,
    RegistroAuditoriaReglaZona,
} from "../../../../domain/ports/out/auditoria-reglas-zona.port";

// Escribe con el gestor de la transacción del cambio que audita (ver TypeOrmUnidadTrabajoReglasZona).
export class TypeOrmAuditoriaReglasZonaAdapter implements IAuditoriaReglasZona {
    constructor(private readonly gestor: Pick<EntityManager, "query">) {}

    async registrar(r: RegistroAuditoriaReglaZona): Promise<void> {
        await this.gestor.query(
            `INSERT INTO auditoria_reglas_zona (id,accion,actor_usuario_id,regla_id,detalle,fecha) VALUES ($1,$2,$3,$4,$5,$6)`,
            [randomUUID(), r.accion, r.actorUsuarioId, r.reglaId, JSON.stringify(r.detalle), new Date()],
        );
    }
}
