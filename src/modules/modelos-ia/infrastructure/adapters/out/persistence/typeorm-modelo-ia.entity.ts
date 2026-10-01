import { Entity, PrimaryColumn, Column, Index, ManyToOne, JoinColumn } from "typeorm";
import { TypeOrmUsuarioEntity } from "../../../../../autenticacion/infrastructure/adapters/out/persistence/typeorm-usuario.entity";

// Inventario de empaquetados IA (RF-09.1, RF-09.5).
// NOTA: frente al documento de base de datos original:
// - "adopcion_pct" no se guarda: se calcula de las detecciones al consultar, para que nunca quede vieja.
// - Se agregan formato, rutas, tamaño, sha256 y firma de los artefactos (los exige la app para instalar),
//   el porcentaje del canario y los datos del kill-switch (RF-09.3).
@Entity("modelos_ia")
export class TypeOrmModeloIaEntity {
    @PrimaryColumn("uuid")
    id: string;

    @Column({ type: "varchar", length: 30, unique: true })
    version: string;

    @Column({ type: "varchar", length: 10 })
    formato: string;

    // Indexado porque el manifiesto de la app busca el modelo vigente por canal
    @Index()
    @Column({ type: "varchar", length: 20 })
    canal: string;

    @Column({ name: "version_min_app", type: "varchar", length: 30 })
    versionMinApp: string;

    @Column({ type: "text", nullable: true })
    notas: string | null;

    // Rutas dentro del almacenamiento privado, nunca URLs públicas
    @Column({ name: "ruta_modelo", type: "varchar", length: 255 })
    rutaModelo: string;

    @Column({ name: "ruta_etiquetas", type: "varchar", length: 255, nullable: true })
    rutaEtiquetas: string | null;

    @Column({ name: "ruta_calibracion", type: "varchar", length: 255, nullable: true })
    rutaCalibracion: string | null;

    @Column({ name: "tamano_bytes", type: "int" })
    tamanoBytes: number;

    @Column({ type: "varchar", length: 64 })
    sha256: string;

    @Column({ type: "varchar", length: 100, nullable: true })
    firma: string | null;

    @Column({ name: "numero_clases", type: "int", nullable: true })
    numeroClases: number | null;

    // Copia de la regla del dominio (publicado y sin kill-switch) para poder filtrar en SQL
    @Column({ type: "boolean", default: false })
    activo: boolean;

    @Column({ name: "creado_por", type: "uuid" })
    creadoPor: string;

    // RESTRICT: no se pierde quién subió cada versión
    @ManyToOne(() => TypeOrmUsuarioEntity, { onDelete: "RESTRICT" })
    @JoinColumn({ name: "creado_por" })
    creador?: TypeOrmUsuarioEntity;

    @Column({ name: "fecha_creacion", type: "timestamp" })
    fechaCreacion: Date;

    @Column({ name: "fecha_publicacion", type: "timestamp", nullable: true })
    fechaPublicacion: Date | null;

    @Column({ name: "porcentaje_canario", type: "int", nullable: true })
    porcentajeCanario: number | null;

    @Column({ name: "kill_switch", type: "boolean", default: false })
    killSwitch: boolean;

    @Column({ name: "motivo_kill_switch", type: "text", nullable: true })
    motivoKillSwitch: string | null;

    @Column({ name: "fecha_kill_switch", type: "timestamp", nullable: true })
    fechaKillSwitch: Date | null;
}
