import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn, Unique } from "typeorm";
import { TypeOrmPlagaEntity } from "./typeorm-plaga.entity";
import { TypeOrmAgronomoEntity } from "../../../../../agronomos/infrastructure/adapters/out/persistence/typeorm-agronomo.entity";

// NOTA: el aval profesional no existe en el documento de base de datos original.
// Se agrega por RF-05.7: es lo que libera el protocolo químico de la ficha (RF-05.6).
@Entity("avales_plaga")
@Unique(["plagaId", "agronomoId"])
export class TypeOrmAvalPlagaEntity {
    @PrimaryColumn("uuid")
    id: string;

    @Column({ name: "plaga_id", type: "uuid" })
    plagaId: string;

    // Sin orphanedRowAction: los avales nunca se borran desde el agregado
    @ManyToOne(() => TypeOrmPlagaEntity, (plaga) => plaga.avales, { onDelete: "CASCADE" })
    @JoinColumn({ name: "plaga_id" })
    plaga?: TypeOrmPlagaEntity;

    @Column({ name: "agronomo_id", type: "uuid" })
    agronomoId: string;

    // RESTRICT: no se puede borrar un agrónomo que firmó avales, son evidencia
    @ManyToOne(() => TypeOrmAgronomoEntity, { onDelete: "RESTRICT" })
    @JoinColumn({ name: "agronomo_id" })
    agronomo?: TypeOrmAgronomoEntity;

    // Copia de la tarjeta profesional al momento de firmar: se conserva aunque
    // después cambie el registro en "agronomos"
    @Column({ name: "numero_tarjeta", type: "varchar", length: 50 })
    numeroTarjeta: string;

    @Column({ name: "fecha_aval", type: "timestamp" })
    fechaAval: Date;
}
