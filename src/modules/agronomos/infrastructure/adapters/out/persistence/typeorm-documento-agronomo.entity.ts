import { Entity, PrimaryColumn, Column, Index, ManyToOne, JoinColumn } from "typeorm";
import { TypeOrmAgronomoEntity } from "./typeorm-agronomo.entity";

// NOTA: "documentos_agronomo" no existe en el documento de base de datos original.
// Se agrega por RF-10.4: custodiar los soportes de acreditación entregados en el alta.
@Entity("documentos_agronomo")
export class TypeOrmDocumentoAgronomoEntity {
    @PrimaryColumn("uuid")
    id: string;

    @Index()
    @Column({ name: "agronomo_id", type: "uuid" })
    agronomoId: string;

    @ManyToOne(() => TypeOrmAgronomoEntity, { onDelete: "CASCADE" })
    @JoinColumn({ name: "agronomo_id" })
    agronomo?: TypeOrmAgronomoEntity;

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
