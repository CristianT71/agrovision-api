import { Entity, PrimaryColumn, Column } from "typeorm";

@Entity("solicitudes")
export class TypeOrmSolicitudEntity {
    @PrimaryColumn("uuid")
    id: string;

    @Column({ name: "productor_id", type: "uuid" })
    productorId: string;

    @Column({ name: "agronomo_id", type: "uuid", nullable: true })
    agronomoId: string | null;

    @Column({ type: "varchar", length: 50 })
    estado: string;

    @Column({ type: "timestamp" })
    fecha: Date;

    @Column({ type: "varchar", length: 100 })
    municipio: string;

    @Column({ type: "varchar", length: 100 })
    vereda: string;

    @Column({ type: "varchar", length: 100 })
    finca: string;

    @Column({ name: "confianza_ia", type: "float" })
    confianzaIa: number;

    @Column({ name: "modelo_version_id", type: "uuid" })
    modeloVersionId: string;

    @Column({ name: "respuesta_profesional", type: "text", nullable: true })
    respuestaProfesional: string;

    @Column({ name: "tipo_resultado", type: "varchar", length: 100, nullable: true })
    tipoResultado: string;
}
