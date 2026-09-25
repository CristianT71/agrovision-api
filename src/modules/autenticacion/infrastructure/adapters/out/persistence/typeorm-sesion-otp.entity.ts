import { Entity, PrimaryColumn, Column, Index, ManyToOne, JoinColumn } from "typeorm";
import { TypeOrmUsuarioEntity } from "./typeorm-usuario.entity";

@Entity("sesiones_otp")
// Indexado porque cada login busca la última sesión del usuario (RNF-01.1: OTP en menos de 2 s)
@Index(["usuarioId", "creadoEn"])
export class TypeOrmSesionOtpEntity {
    @PrimaryColumn("uuid")
    id: string;

    @Column({ name: "usuario_id", type: "uuid" })
    usuarioId: string;

    @ManyToOne(() => TypeOrmUsuarioEntity, { onDelete: "CASCADE" })
    @JoinColumn({ name: "usuario_id" })
    usuario?: TypeOrmUsuarioEntity;

    // NOTA: en el documento de base de datos original era "codigo" en texto plano.
    // Se guarda el hash SHA-256 para que una fuga de la tabla no exponga códigos vigentes.
    @Column({ name: "codigo_hash", type: "varchar", length: 64 })
    codigoHash: string;

    @Column({ name: "expira_en", type: "timestamp" })
    expiraEn: Date;

    @Column({ type: "boolean", default: false })
    usado: boolean;

    // NOTA: "intentos" no existe en el documento de base de datos original.
    // Se agrega para bloquear el código tras varios intentos fallidos (fuerza bruta).
    @Column({ type: "int", default: 0 })
    intentos: number;

    @Column({ name: "creado_en", type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
    creadoEn: Date;
}
