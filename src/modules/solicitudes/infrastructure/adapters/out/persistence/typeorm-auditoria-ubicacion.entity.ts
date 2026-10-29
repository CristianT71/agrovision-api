import { Entity, PrimaryColumn, Column, Index } from "typeorm";

// Log inmutable de consultas de ubicación exacta (RNF-01.2). La migración CrearAuditoriaUbicaciones instala el
// trigger que rechaza UPDATE, DELETE y TRUNCATE. Sin FK a solicitudes: el rastro sobrevive a cualquier cambio.
@Index("IDX_auditoria_ubicaciones_solicitud_fecha", ["solicitudId", "fecha"])
@Index("IDX_auditoria_ubicaciones_actor_fecha", ["actorUsuarioId", "fecha"])
@Entity("auditoria_ubicaciones")
export class TypeOrmAuditoriaUbicacionEntity {
    @PrimaryColumn("uuid")
    id: string;

    @Column({ type: "varchar", length: 30 })
    accion: string;

    @Column({ name: "actor_usuario_id", type: "uuid" })
    actorUsuarioId: string;

    @Column({ name: "solicitud_id", type: "uuid", nullable: true })
    solicitudId: string | null;

    @Column({ type: "jsonb", nullable: true })
    filtros: object | null;

    @Column({ type: "int", nullable: true })
    resultados: number | null;

    @Column({ type: "timestamptz" })
    fecha: Date;
}
