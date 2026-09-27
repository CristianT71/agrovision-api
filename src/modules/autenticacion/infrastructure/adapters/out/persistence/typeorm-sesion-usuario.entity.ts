import { Entity, PrimaryColumn, Column, Index, ManyToOne, JoinColumn } from "typeorm";
import { TypeOrmUsuarioEntity } from "./typeorm-usuario.entity";

// NOTA: "sesiones_usuario" no existe en el documento de base de datos original.
// Se agrega por RNF-02.2 (cierre por inactividad) y RF-01.8 (invalidar el token al cerrar sesión).
@Entity("sesiones_usuario")
export class TypeOrmSesionUsuarioEntity {
    // Es el "jti" del token: la API lo busca en cada petición
    @PrimaryColumn("uuid")
    id: string;

    @Index()
    @Column({ name: "usuario_id", type: "uuid" })
    usuarioId: string;

    @ManyToOne(() => TypeOrmUsuarioEntity, { onDelete: "CASCADE" })
    @JoinColumn({ name: "usuario_id" })
    usuario?: TypeOrmUsuarioEntity;

    @Column({ type: "varchar", length: 20 })
    rol: string;

    @Column({ name: "creada_en", type: "timestamptz" })
    creadaEn: Date;

    @Column({ name: "expira_en", type: "timestamptz" })
    expiraEn: Date;

    @Column({ name: "ultima_actividad", type: "timestamptz" })
    ultimaActividad: Date;

    @Column({ name: "revocada_en", type: "timestamptz", nullable: true })
    revocadaEn: Date | null;
}
