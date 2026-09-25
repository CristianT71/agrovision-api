import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn, Unique } from "typeorm";
import { TypeOrmPlagaEntity } from "./typeorm-plaga.entity";

// NOTA: los sinónimos son una lista dinámica por ficha (RF-05.5) y alimentan la
// búsqueda del catálogo (RF-05.2).
@Entity("sinonimos_plaga")
@Unique(["plagaId", "sinonimo"])
export class TypeOrmSinonimoPlagaEntity {
    @PrimaryColumn("uuid")
    id: string;

    @Column({ name: "plaga_id", type: "uuid" })
    plagaId: string;

    // orphanedRowAction "delete": quitar un sinónimo de la lista borra su fila
    @ManyToOne(() => TypeOrmPlagaEntity, (plaga) => plaga.sinonimos, {
        onDelete: "CASCADE",
        orphanedRowAction: "delete",
    })
    @JoinColumn({ name: "plaga_id" })
    plaga?: TypeOrmPlagaEntity;

    @Column({ type: "varchar", length: 150 })
    sinonimo: string;
}
