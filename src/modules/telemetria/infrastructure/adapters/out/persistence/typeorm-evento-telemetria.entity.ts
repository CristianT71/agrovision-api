import { Column, Entity, Index, PrimaryColumn } from "typeorm";

// Telemetría anónima de la app: sin productor ni ubicación, a propósito
@Entity("eventos_telemetria")
@Index(["tipo", "ocurridoEn"])
@Index(["versionModelo", "ocurridoEn"])
export class TypeOrmEventoTelemetriaEntity {
    @PrimaryColumn("uuid")
    id: string;

    @Column({ type: "varchar", length: 20 })
    tipo: string;

    @Column({ name: "instalacion_id", type: "varchar", length: 64, nullable: true })
    instalacionId: string | null;

    @Column({ name: "version_app", type: "varchar", length: 20, nullable: true })
    versionApp: string | null;

    @Column({ name: "version_modelo", type: "varchar", length: 30, nullable: true })
    versionModelo: string | null;

    @Column({ type: "varchar", length: 30, nullable: true })
    resultado: string | null;

    @Column({ type: "real", nullable: true })
    confianza: number | null;

    @Column({ name: "latencia_ms", type: "int", nullable: true })
    latenciaMs: number | null;

    @Column({ type: "varchar", length: 20, nullable: true })
    delegado: string | null;

    @Column({ name: "clase_origen", type: "varchar", length: 100, nullable: true })
    claseOrigen: string | null;

    @Column({ name: "clase_destino", type: "varchar", length: 100, nullable: true })
    claseDestino: string | null;

    @Column({ name: "version_origen", type: "varchar", length: 30, nullable: true })
    versionOrigen: string | null;

    @Column({ name: "version_destino", type: "varchar", length: 30, nullable: true })
    versionDestino: string | null;

    @Column({ type: "boolean", nullable: true })
    exito: boolean | null;

    // Con zona horaria: se compara contra fechas que vienen de celulares en epoch ms
    @Column({ name: "ocurrido_en", type: "timestamptz" })
    ocurridoEn: Date;

    @Column({ name: "recibido_en", type: "timestamptz" })
    recibidoEn: Date;
}
