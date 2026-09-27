import { Entity, PrimaryColumn, Column, Index, ManyToOne, JoinColumn } from "typeorm";
import { TypeOrmSolicitudEntity } from "./typeorm-solicitud.entity";

// NOTA: "anexos_resolucion" no existe en el documento de base de datos original.
// Se agrega por RF-04.6: la resolución admite imágenes y reportes PDF como anexos.
@Entity("anexos_resolucion")
export class TypeOrmAnexoResolucionEntity {
    @PrimaryColumn("uuid")
    id: string;

    @Index()
    @Column({ name: "solicitud_id", type: "uuid" })
    solicitudId: string;

    @ManyToOne(() => TypeOrmSolicitudEntity, { onDelete: "CASCADE" })
    @JoinColumn({ name: "solicitud_id" })
    solicitud?: TypeOrmSolicitudEntity;

    // Ruta dentro del almacenamiento privado, nunca una URL pública
    @Column({ type: "varchar", length: 255 })
    ruta: string;

    @Column({ name: "nombre_original", type: "varchar", length: 255 })
    nombreOriginal: string;

    @Column({ name: "tipo_mime", type: "varchar", length: 100 })
    tipoMime: string;

    @Column({ name: "tamano_bytes", type: "int" })
    tamanoBytes: number;

    @Column({ name: "fecha_subida", type: "timestamp" })
    fechaSubida: Date;
}
