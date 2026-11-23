import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { DataSource, EntityManager } from "typeorm";
import type { IAuditoriaVuelos, RegistroAuditoriaVuelo } from "../../../../domain/ports/out/auditoria-vuelos.port";

@Injectable()
export class TypeOrmAuditoriaVuelosAdapter implements IAuditoriaVuelos {
    constructor(private readonly db: DataSource) {}
    async registrar(registro: RegistroAuditoriaVuelo): Promise<void> {
        await this.registrarConGestor(this.db.manager, registro);
    }
    async registrarConGestor(gestor: EntityManager, r: RegistroAuditoriaVuelo): Promise<void> {
        await gestor.query(
            `INSERT INTO auditoria_vuelos (id,accion,actor_usuario_id,vuelo_id,archivo_id,fecha) VALUES ($1,$2,$3,$4,$5,$6)`,
            [randomUUID(), r.accion, r.actorUsuarioId, r.vueloId, r.archivoId ?? null, new Date()],
        );
    }
}
