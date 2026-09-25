import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from "typeorm";
import { TypeOrmMensajeEntity } from "./typeorm-mensaje.entity";

// Archivos que el administrador adjunta a sus instrucciones (RF-08.5).
// NOTA: el documento de base de datos original define "url"; aquí se guarda "ruta" porque el
// archivo es privado y se descarga por un endpoint protegido, igual que documentos_agronomo.
// Se agregan "tipo_mime" y "tamano_bytes" para servir la descarga sin volver a inspeccionar el archivo.
@Entity("adjuntos_mensaje")
export class TypeOrmAdjuntoMensajeEntity {
    @PrimaryColumn("uuid")
    id: string;

    @Column({ name: "mensaje_id", type: "uuid" })
    mensajeId: string;

    @ManyToOne(() => TypeOrmMensajeEntity, (mensaje) => mensaje.adjuntos, { onDelete: "CASCADE" })
    @JoinColumn({ name: "mensaje_id" })
    mensaje?: TypeOrmMensajeEntity;

    // Ruta dentro del almacenamiento privado, nunca una URL pública
    @Column({ type: "text" })
    ruta: string;

    @Column({ name: "nombre_archivo", type: "varchar", length: 255 })
    nombreArchivo: string;

    @Column({ name: "tipo_mime", type: "varchar", length: 100 })
    tipoMime: string;

    @Column({ name: "tamano_bytes", type: "int" })
    tamanoBytes: number;

    // "imagen" o "documento": el tipo "video" del documento queda fuera de este alcance
    @Column({ type: "varchar", length: 20 })
    tipo: string;
}
