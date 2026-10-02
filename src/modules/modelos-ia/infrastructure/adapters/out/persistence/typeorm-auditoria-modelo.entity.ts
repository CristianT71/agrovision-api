import { Entity, PrimaryColumn, Column, Index, ManyToOne, JoinColumn } from "typeorm";
import { TypeOrmModeloIaEntity } from "./typeorm-modelo-ia.entity";
import { TypeOrmUsuarioEntity } from "../../../../../autenticacion/infrastructure/adapters/out/persistence/typeorm-usuario.entity";

// NOTA: "auditoria_modelos" no existe en el documento de base de datos original.
// Se agrega por RF-09.4 y RNF-01.2: log inmutable de operador, fecha y causa de cada acción sobre
// un modelo. La migración instala un trigger que rechaza UPDATE, DELETE y TRUNCATE en esta tabla.
@Index(["modeloId", "fecha"])
@Entity("auditoria_modelos")
export class TypeOrmAuditoriaModeloEntity {
    @PrimaryColumn("uuid")
    id: string;

    @Column({ name: "modelo_id", type: "uuid" })
    modeloId: string;

    // RESTRICT: un modelo con historial no se puede borrar
    @ManyToOne(() => TypeOrmModeloIaEntity, { onDelete: "RESTRICT" })
    @JoinColumn({ name: "modelo_id" })
    modelo?: TypeOrmModeloIaEntity;

    @Column({ type: "varchar", length: 30 })
    accion: string;

    @Column({ name: "actor_usuario_id", type: "uuid" })
    actorUsuarioId: string;

    // RESTRICT: el operador de un evento auditado nunca se pierde
    @ManyToOne(() => TypeOrmUsuarioEntity, { onDelete: "RESTRICT" })
    @JoinColumn({ name: "actor_usuario_id" })
    actor?: TypeOrmUsuarioEntity;

    @Column({ type: "text", nullable: true })
    motivo: string | null;

    // Datos propios de cada acción (versión, canal anterior y nuevo, porcentaje...)
    @Column({ type: "jsonb", nullable: true })
    detalle: object | null;

    @Column({ type: "timestamptz" })
    fecha: Date;
}
