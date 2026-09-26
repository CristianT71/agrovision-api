import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn, Index, Unique } from "typeorm";
import { TypeOrmSolicitudEntity } from "./typeorm-solicitud.entity";

// Fotos que la app móvil adjunta a una solicitud. Se crean al recibir el lote (sin archivo)
// y se completan cuando la app sube cada una por su URL firmada.
// NOTA: tabla nueva, no existe en el documento de base de datos original.

@Entity("fotos_solicitud")
@Unique(["solicitudId", "orden"])
export class TypeOrmFotoSolicitudEntity {
    @PrimaryColumn("uuid")
    id: string;

    // PostgreSQL no indexa las FKs automáticamente y las fotos se cargan por solicitud
    @Index()
    @Column({ name: "solicitud_id", type: "uuid" })
    solicitudId: string;

    @ManyToOne(() => TypeOrmSolicitudEntity, { onDelete: "CASCADE" })
    @JoinColumn({ name: "solicitud_id" })
    solicitud?: TypeOrmSolicitudEntity;

    @Column({ name: "id_cliente", type: "uuid", unique: true })
    idCliente: string;

    @Column({ type: "varchar", length: 20 })
    angulo: string;

    @Column({ type: "smallint" })
    orden: number;

    // Ruta dentro del almacenamiento privado; null hasta que la app sube el archivo
    @Column({ type: "text", nullable: true })
    ruta: string | null;

    @Column({ name: "tipo_mime", type: "varchar", length: 100, nullable: true })
    tipoMime: string | null;

    @Column({ name: "tamano_bytes", type: "int", nullable: true })
    tamanoBytes: number | null;

    @Column({ name: "subida_en", type: "timestamp", nullable: true })
    subidaEn: Date | null;
}
