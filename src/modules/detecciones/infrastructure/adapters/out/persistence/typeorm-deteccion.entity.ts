import { Entity, PrimaryColumn, Column, Index, ManyToOne, JoinColumn } from "typeorm";
import { TypeOrmProductorEntity } from "../../../../../productores/infrastructure/adapters/out/persistence/typeorm-productor.entity";
import { TypeOrmModeloIaEntity } from "../../../../../modelos-ia/infrastructure/adapters/out/persistence/typeorm-modelo-ia.entity";

// Inferencias crudas del modelo en los teléfonos (RF-07.1).
// NOTA: frente al documento de base de datos original:
// - Se agregan los datos que envía la app (clase predicha, puntaje OOD, compuerta, corrección del
//   productor, cultivo, órgano, coordenadas, embedding) y "defectuosa" (RF-07.4).
// - "plaga_id" y "foto_url" se omiten: la app no envía el id de la ficha del catálogo ni la imagen.
// - "tipo" admite también "enfermedad" y "otra" (ver categoria-biologica.ts).
@Entity("detecciones_app")
export class TypeOrmDeteccionEntity {
    @PrimaryColumn("uuid")
    id: string;

    // Id que genera la app: hace idempotente el reenvío del lote
    @Column({ name: "id_cliente", type: "uuid", unique: true })
    idCliente: string;

    @Index()
    @Column({ name: "productor_id", type: "uuid" })
    productorId: string;

    // RESTRICT: el historial de detecciones no se pierde si se intenta borrar al productor
    @ManyToOne(() => TypeOrmProductorEntity, { onDelete: "RESTRICT" })
    @JoinColumn({ name: "productor_id" })
    productor?: TypeOrmProductorEntity;

    // Indexado porque el monitor agrupa y excluye por categoría (RF-07.2)
    @Index()
    @Column({ type: "varchar", length: 20 })
    tipo: string;

    @Column({ name: "clase_predicha", type: "varchar", length: 100, nullable: true })
    clasePredicha: string | null;

    @Column({ type: "real", nullable: true })
    confianza: number | null;

    @Column({ name: "puntaje_ood", type: "real" })
    puntajeOod: number;

    @Column({ name: "resultado_compuerta", type: "varchar", length: 20 })
    resultadoCompuerta: string;

    // Indexado porque el tablero segmenta la tasa de error por versión del modelo (RF-06.3)
    @Index()
    @Column({ name: "modelo_id", type: "uuid", nullable: true })
    modeloId: string | null;

    // SET NULL: se conserva la versión en texto aunque el modelo se borre del inventario
    @ManyToOne(() => TypeOrmModeloIaEntity, { onDelete: "SET NULL" })
    @JoinColumn({ name: "modelo_id" })
    modelo?: TypeOrmModeloIaEntity;

    @Column({ name: "modelo_version", type: "varchar", length: 30 })
    modeloVersion: string;

    @Column({ name: "correccion_productor", type: "varchar", length: 100, nullable: true })
    correccionProductor: string | null;

    @Column({ name: "confirmada_productor", type: "boolean", default: false })
    confirmadaProductor: boolean;

    @Column({ type: "varchar", length: 20, nullable: true })
    cultivo: string | null;

    @Column({ type: "varchar", length: 20, nullable: true })
    organo: string | null;

    @Column({ type: "double precision", nullable: true })
    latitud: number | null;

    @Column({ type: "double precision", nullable: true })
    longitud: number | null;

    @Column({ name: "precision_metros", type: "real", nullable: true })
    precisionMetros: number | null;

    // float16 en Base64, como lo envía la app; servirá para agrupar casos por similitud
    @Column({ type: "text", nullable: true })
    embedding: string | null;

    @Column({ type: "varchar", length: 100 })
    municipio: string;

    // Momento de la captura en el teléfono. Indexado: el monitor y el tablero filtran por fechas.
    @Index()
    @Column({ type: "timestamp" })
    fecha: Date;

    @Column({ name: "recibida_en", type: "timestamptz" })
    recibidaEn: Date;

    // RF-07.4: inferencias con confianza absoluta de cero
    @Column({ type: "boolean", default: false })
    defectuosa: boolean;
}
