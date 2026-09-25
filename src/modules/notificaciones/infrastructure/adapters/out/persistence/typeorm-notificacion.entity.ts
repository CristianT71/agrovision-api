import { Entity, PrimaryColumn, Column, Index, ManyToOne, JoinColumn } from "typeorm";
import { TypeOrmUsuarioEntity } from "../../../../../autenticacion/infrastructure/adapters/out/persistence/typeorm-usuario.entity";

// Alertas de estado de la cuenta (RF-02.5, RF-02.6).
// DIFERENCIA con el documento de base de datos: se agregan "referencia_tipo" y "referencia_id"
// para que la notificación sea contextual (RF-02.5) y el frontend pueda llevar al usuario
// al caso o a la ficha correspondiente.
@Index(["usuarioId", "leida"])
@Index(["usuarioId", "fecha"])
@Entity("notificaciones")
export class TypeOrmNotificacionEntity {
    @PrimaryColumn("uuid")
    id: string;

    @Column({ name: "usuario_id", type: "uuid" })
    usuarioId: string;

    // CASCADE: los avisos de una cuenta no sobreviven a la cuenta
    @ManyToOne(() => TypeOrmUsuarioEntity, { onDelete: "CASCADE" })
    @JoinColumn({ name: "usuario_id" })
    usuario?: TypeOrmUsuarioEntity;

    @Column({ type: "varchar", length: 30 })
    tipo: string;

    @Column({ type: "varchar", length: 150 })
    titulo: string;

    @Column({ type: "varchar", length: 500 })
    descripcion: string;

    @Column({ name: "referencia_tipo", type: "varchar", length: 20, nullable: true })
    referenciaTipo: string | null;

    @Column({ name: "referencia_id", type: "uuid", nullable: true })
    referenciaId: string | null;

    @Column({ type: "boolean", default: false })
    leida: boolean;

    @Column({ type: "timestamp" })
    fecha: Date;
}
