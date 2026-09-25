import { Entity, PrimaryColumn, Column, Index, ManyToOne, JoinColumn, OneToMany } from "typeorm";
import { TypeOrmSolicitudEntity } from "../../../../../solicitudes/infrastructure/adapters/out/persistence/typeorm-solicitud.entity";
import { TypeOrmUsuarioEntity } from "../../../../../autenticacion/infrastructure/adapters/out/persistence/typeorm-usuario.entity";
import { TypeOrmAdjuntoMensajeEntity } from "./typeorm-adjunto-mensaje.entity";

// Bitácora de coordinación entre administrador y agrónomo asignado (RF-04.9).
// NOTA: "contenido" es nullable, a diferencia del documento de base de datos original:
// un mensaje puede ser solo adjuntos (RF-08.5).
@Index(["solicitudId", "fecha"])
@Index(["solicitudId", "leido"])
@Entity("mensajes")
export class TypeOrmMensajeEntity {
    @PrimaryColumn("uuid")
    id: string;

    @Column({ name: "solicitud_id", type: "uuid" })
    solicitudId: string;

    // CASCADE: la bitácora no tiene sentido sin la solicitud que coordina
    @ManyToOne(() => TypeOrmSolicitudEntity, { onDelete: "CASCADE" })
    @JoinColumn({ name: "solicitud_id" })
    solicitud?: TypeOrmSolicitudEntity;

    @Column({ name: "autor_id", type: "uuid" })
    autorId: string;

    // RESTRICT: el historial de coordinación no se pierde al intentar borrar la cuenta del autor
    @ManyToOne(() => TypeOrmUsuarioEntity, { onDelete: "RESTRICT" })
    @JoinColumn({ name: "autor_id" })
    autor?: TypeOrmUsuarioEntity;

    // Lado del canal que escribió: todos los administradores comparten el lado "admin"
    @Column({ name: "autor_tipo", type: "varchar", length: 20 })
    autorTipo: string;

    @Column({ type: "text", nullable: true })
    contenido: string | null;

    @Column({ type: "timestamp" })
    fecha: Date;

    @Column({ type: "boolean", default: false })
    leido: boolean;

    @OneToMany(() => TypeOrmAdjuntoMensajeEntity, (adjunto) => adjunto.mensaje, { cascade: ["insert"] })
    adjuntos?: TypeOrmAdjuntoMensajeEntity[];
}
