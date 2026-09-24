import { Entity, PrimaryColumn, Column, Index, OneToOne, JoinColumn } from "typeorm";
import { TypeOrmUsuarioEntity } from "../../../../../autenticacion/infrastructure/adapters/out/persistence/typeorm-usuario.entity";

@Entity("productores")
export class TypeOrmProductorEntity {
    @PrimaryColumn("uuid")
    id: string;

    // NOTA: "usuario_id" no existe en el documento de base de datos original.
    // Se agrega para vincular al productor con su cuenta en "usuarios" (rol "productor"),
    // igual que se hizo con agronomos.
    @Column({ name: "usuario_id", type: "uuid", unique: true })
    usuarioId: string;

    @OneToOne(() => TypeOrmUsuarioEntity, { onDelete: "CASCADE" })
    @JoinColumn({ name: "usuario_id" })
    usuario?: TypeOrmUsuarioEntity;

    // Indexado porque las bandejas buscan por nombre (RNF-03.1: filtros en menos de 300 ms)
    @Index()
    @Column({ type: "varchar", length: 150 })
    nombre: string;

    @Column({ type: "varchar", length: 150 })
    finca: string;

    @Column({ type: "varchar", length: 100 })
    vereda: string;

    // Indexado porque las bandejas filtran por municipio (RNF-03.1: filtros en menos de 300 ms)
    @Index()
    @Column({ type: "varchar", length: 100 })
    municipio: string;

    @Column({ type: "varchar", length: 20, unique: true })
    telefono: string;

    @Column({ type: "varchar", length: 20, default: "registrado" })
    estado: string;

    @Column({ type: "boolean", default: false })
    consentimiento: boolean;

    @Column({ name: "fecha_consentimiento", type: "timestamp", nullable: true })
    fechaConsentimiento: Date | null;
}
