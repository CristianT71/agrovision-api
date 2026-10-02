import { Entity, PrimaryColumn, Column, Index, ManyToOne, JoinColumn } from "typeorm";
import { TypeOrmModeloIaEntity } from "./typeorm-modelo-ia.entity";

// Variables de rendimiento de cada compilación (RF-09.2).
// NOTA: "clase" no existe en el documento de base de datos original. Se agrega para guardar también
// las métricas por clase (null = global), como las reporta la memoria técnica del entrenamiento.
@Entity("metricas_modelo")
export class TypeOrmMetricaModeloEntity {
    @PrimaryColumn("uuid")
    id: string;

    @Index()
    @Column({ name: "modelo_id", type: "uuid" })
    modeloId: string;

    // CASCADE: las métricas no tienen sentido sin la compilación que miden
    @ManyToOne(() => TypeOrmModeloIaEntity, (modelo) => modelo.metricas, { onDelete: "CASCADE" })
    @JoinColumn({ name: "modelo_id" })
    modelo?: TypeOrmModeloIaEntity;

    @Column({ type: "varchar", length: 100, nullable: true })
    clase: string | null;

    @Column({ type: "real" })
    precision: number;

    @Column({ type: "real" })
    recall: number;

    @Column({ type: "real" })
    f1: number;
}
