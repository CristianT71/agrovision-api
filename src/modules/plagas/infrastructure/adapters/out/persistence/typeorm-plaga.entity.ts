import { Entity, PrimaryColumn, Column, Index, OneToMany } from "typeorm";
import { TypeOrmSinonimoPlagaEntity } from "./typeorm-sinonimo-plaga.entity";
import { TypeOrmAvalPlagaEntity } from "./typeorm-aval-plaga.entity";

@Entity("plagas")
export class TypeOrmPlagaEntity {
    @PrimaryColumn("uuid")
    id: string;

    // Indexado porque el catálogo busca y ordena por nombre común (RF-05.2)
    @Index()
    @Column({ name: "nombre_comun", type: "varchar", length: 150 })
    nombreComun: string;

    // NOTA: nullable respecto al documento de base de datos original. Una deficiencia o una
    // ficha "sano" puede no tener nombre científico; PostgreSQL admite varios NULL en una
    // columna unique, así que la unicidad solo aplica a los valores presentes.
    @Column({ name: "nombre_cientifico", type: "varchar", length: 150, nullable: true, unique: true })
    nombreCientifico: string | null;

    // Indexado porque el catálogo filtra por tipo (RF-05.1)
    @Index()
    @Column({ type: "varchar", length: 20 })
    tipo: string;

    @Column({ type: "text" })
    descripcion: string;

    @Column({ type: "text" })
    sintomas: string;

    @Column({ type: "varchar", length: 100, default: "cafe" })
    cultivo: string;

    // NOTA: en el documento de base de datos original era un campo simple; pasa a arreglo
    // para manejarlo como lista.
    @Column({ name: "organos_afectados", type: "text", array: true })
    organosAfectados: string[];

    // NOTA: "hospederos" no existe en el documento de base de datos original.
    // Se agrega por RF-05.5 (lista dinámica de hospederos).
    @Column({ type: "text", array: true, default: "{}" })
    hospederos: string[];

    // NOTA: "medidas_contencion" no existe en el documento de base de datos original.
    // Se agrega por RF-05.4.
    @Column({ name: "medidas_contencion", type: "text" })
    medidasContencion: string;

    // NOTA: "protocolo_quimico" no existe en el documento de base de datos original.
    // Se agrega por RF-05.6 / RF-05.7: los parámetros químicos y la dosificación quedan
    // bloqueados mientras la ficha no tenga aval profesional.
    @Column({ name: "protocolo_quimico", type: "text", nullable: true })
    protocoloQuimico: string | null;

    @Column({ name: "foto_url", type: "text", nullable: true })
    fotoUrl: string | null;

    // Los sinónimos se escriben siempre a través de la raíz del agregado
    @OneToMany(() => TypeOrmSinonimoPlagaEntity, (sinonimo) => sinonimo.plaga, { cascade: true })
    sinonimos?: TypeOrmSinonimoPlagaEntity[];

    // Los avales solo se insertan desde la raíz: nunca se actualizan ni se borran (RF-05.7)
    @OneToMany(() => TypeOrmAvalPlagaEntity, (aval) => aval.plaga, { cascade: ["insert"] })
    avales?: TypeOrmAvalPlagaEntity[];
}
