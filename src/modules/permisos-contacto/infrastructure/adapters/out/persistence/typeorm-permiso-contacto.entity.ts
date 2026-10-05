import { Entity, PrimaryColumn, Column, OneToOne, ManyToOne, JoinColumn } from "typeorm";
import { TypeOrmSolicitudEntity } from "../../../../../solicitudes/infrastructure/adapters/out/persistence/typeorm-solicitud.entity";
import { TypeOrmAgronomoEntity } from "../../../../../agronomos/infrastructure/adapters/out/persistence/typeorm-agronomo.entity";
import { TypeOrmUsuarioEntity } from "../../../../../autenticacion/infrastructure/adapters/out/persistence/typeorm-usuario.entity";

// Permiso de contacto directo productor-evaluador por solicitud (RF-04.10, RF-08.8).
// NOTA: "agronomo_id", "revocado_por" y "fecha_revocado" no existen en el documento de base de datos
// original. El agrónomo fija a quién se otorgó (una reasignación no hereda el permiso) y la revocación
// queda registrada sin borrar quién lo otorgó.
@Entity("permisos_contacto")
export class TypeOrmPermisoContactoEntity {
    @PrimaryColumn("uuid")
    id: string;

    // Relación 1:1 con solicitudes: único, y sirve de índice para buscar el permiso del caso
    @Column({ name: "solicitud_id", type: "uuid", unique: true })
    solicitudId: string;

    // CASCADE: el permiso no tiene sentido sin la solicitud a la que pertenece
    @OneToOne(() => TypeOrmSolicitudEntity, { onDelete: "CASCADE" })
    @JoinColumn({ name: "solicitud_id" })
    solicitud?: TypeOrmSolicitudEntity;

    @Column({ name: "agronomo_id", type: "uuid", nullable: true })
    agronomoId: string | null;

    // SET NULL: si se elimina el agrónomo, el permiso deja de estar vigente para nadie
    @ManyToOne(() => TypeOrmAgronomoEntity, { onDelete: "SET NULL" })
    @JoinColumn({ name: "agronomo_id" })
    agronomo?: TypeOrmAgronomoEntity;

    @Column({ type: "boolean", default: false })
    habilitado: boolean;

    // RESTRICT: no se pierde qué administrador otorgó o revocó el acceso
    @Column({ name: "otorgado_por", type: "uuid", nullable: true })
    otorgadoPor: string | null;

    @ManyToOne(() => TypeOrmUsuarioEntity, { onDelete: "RESTRICT" })
    @JoinColumn({ name: "otorgado_por" })
    otorgante?: TypeOrmUsuarioEntity;

    @Column({ name: "fecha_otorgado", type: "timestamp", nullable: true })
    fechaOtorgado: Date | null;

    @Column({ name: "revocado_por", type: "uuid", nullable: true })
    revocadoPor: string | null;

    @ManyToOne(() => TypeOrmUsuarioEntity, { onDelete: "RESTRICT" })
    @JoinColumn({ name: "revocado_por" })
    revocante?: TypeOrmUsuarioEntity;

    @Column({ name: "fecha_revocado", type: "timestamp", nullable: true })
    fechaRevocado: Date | null;
}
