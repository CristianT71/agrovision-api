import { Entity, PrimaryColumn, Column, OneToOne, JoinColumn } from "typeorm";
import { TypeOrmUsuarioEntity } from "../../../../../autenticacion/infrastructure/adapters/out/persistence/typeorm-usuario.entity";

@Entity("agronomos")
export class TypeOrmAgronomoEntity {
    @PrimaryColumn("uuid")
    id: string;

    // NOTA: "usuario_id" no existe en el documento de base de datos original.
    // Se agregó para vincular al agrónomo con su cuenta de login por OTP (módulo autenticación).
    @Column({ name: "usuario_id", type: "uuid", unique: true })
    usuarioId: string;

    @OneToOne(() => TypeOrmUsuarioEntity, { onDelete: "CASCADE" })
    @JoinColumn({ name: "usuario_id" })
    usuario?: TypeOrmUsuarioEntity;

    @Column({ type: "varchar", length: 150 })
    nombre: string;

    @Column({ name: "tarjeta_profesional", type: "varchar", length: 50, unique: true })
    tarjetaProfesional: string;

    @Column({ type: "varchar", length: 20, unique: true })
    telefono: string;

    @Column({ type: "varchar", length: 150, unique: true })
    correo: string;

    @Column({ type: "varchar", length: 100 })
    especialidad: string;

    // NOTA: el estado "pendiente" no existe en el documento de base de datos original.
    // Se agregó por RF-10.5: todo agrónomo nuevo queda pendiente hasta la validación humana.
    @Column({ type: "varchar", length: 20, default: "pendiente" })
    estado: string;

    @Column({ name: "fecha_alta", type: "timestamp" })
    fechaAlta: Date;
}
