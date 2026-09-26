import { Entity, PrimaryColumn, Column, Index, ManyToOne, JoinColumn, UpdateDateColumn } from "typeorm";
import { TypeOrmProductorEntity } from "../../../../../productores/infrastructure/adapters/out/persistence/typeorm-productor.entity";
import { TypeOrmAgronomoEntity } from "../../../../../agronomos/infrastructure/adapters/out/persistence/typeorm-agronomo.entity";

@Entity("solicitudes")
export class TypeOrmSolicitudEntity {
    @PrimaryColumn("uuid")
    id: string;

    @Column({ name: "productor_id", type: "uuid" })
    productorId: string;

    // RESTRICT: el historial de solicitudes no se pierde si se intenta borrar al productor
    @ManyToOne(() => TypeOrmProductorEntity, { onDelete: "RESTRICT" })
    @JoinColumn({ name: "productor_id" })
    productor?: TypeOrmProductorEntity;

    // Indexado porque la bandeja filtra por agrónomo asignado (RF-03.3, RNF-03.1)
    @Index()
    @Column({ name: "agronomo_id", type: "uuid", nullable: true })
    agronomoId: string | null;

    // SET NULL: si se elimina el agrónomo, la solicitud vuelve a quedar sin asignar
    @ManyToOne(() => TypeOrmAgronomoEntity, { onDelete: "SET NULL" })
    @JoinColumn({ name: "agronomo_id" })
    agronomo?: TypeOrmAgronomoEntity;

    // Indexado porque la bandeja filtra por estado (RF-03.2, RNF-03.1)
    @Index()
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

    // Nulos en las solicitudes de la app móvil: la confianza vive en la captura (detecciones)
    @Column({ name: "confianza_ia", type: "float", nullable: true })
    confianzaIa: number | null;

    @Column({ name: "modelo_version_id", type: "uuid", nullable: true })
    modeloVersionId: string | null;

    @Column({ name: "respuesta_profesional", type: "text", nullable: true })
    respuestaProfesional: string | null;

    @Column({ name: "tipo_resultado", type: "varchar", length: 100, nullable: true })
    tipoResultado: string | null;

    // NOTA: "plaga_identificada" no existe en el documento de base de datos original.
    // Se agrega por RF-04.5: la evaluación humana exige la denominación de la plaga.
    @Column({ name: "plaga_identificada", type: "varchar", length: 150, nullable: true })
    plagaIdentificada: string | null;

    // NOTA: "fecha_resolucion" no existe en el documento de base de datos original.
    // Se agrega para saber cuándo la solicitud pasó a solo lectura (RF-04.8).
    @Column({ name: "fecha_resolucion", type: "timestamp", nullable: true })
    fechaResolucion: Date | null;

    // NOTA: las columnas siguientes no existen en el documento de base de datos original.
    // Las trae la app móvil; son nulas en las solicitudes anteriores a ella.

    // Id que genera la app: hace idempotente el reenvío del lote
    @Column({ name: "id_cliente", type: "uuid", nullable: true, unique: true })
    idCliente: string | null;

    // Sin FK por ahora: la tabla de capturas llegará con el módulo de detecciones
    @Column({ name: "captura_id", type: "uuid", nullable: true })
    capturaId: string | null;

    @Column({ type: "varchar", length: 20, nullable: true })
    cultivo: string | null;

    @Column({ type: "varchar", length: 20, nullable: true })
    organo: string | null;

    @Column({ type: "varchar", length: 500, nullable: true })
    nota: string | null;

    @Column({ type: "double precision", nullable: true })
    latitud: number | null;

    @Column({ type: "double precision", nullable: true })
    longitud: number | null;

    @Column({ name: "precision_metros", type: "real", nullable: true })
    precisionMetros: number | null;

    // La app sincroniza con ?since=: toda escritura (save o update) lo renueva.
    // Con zona horaria porque lo fija now() en la base y se compara con un instante de la app.
    @UpdateDateColumn({ name: "actualizado_en", type: "timestamptz" })
    actualizadoEn: Date;
}
