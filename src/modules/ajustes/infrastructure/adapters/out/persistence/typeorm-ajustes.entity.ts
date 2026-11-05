import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity("ajustes_usuario")
export class TypeOrmAjustesUsuarioEntity {
    @PrimaryColumn({ name: "usuario_id", type: "uuid" })
    usuarioId: string;

    @Column({ type: "jsonb", default: () => "'{}'" })
    datos: Record<string, unknown>;

    @Column({ name: "fecha_actualizacion", type: "timestamp" })
    fechaActualizacion: Date;
}

// Una sola fila (id = 1) con los ajustes de toda la plataforma
@Entity("ajustes_sistema")
export class TypeOrmAjustesSistemaEntity {
    @PrimaryColumn({ type: "smallint" })
    id: number;

    @Column({ type: "jsonb", default: () => "'{}'" })
    datos: Record<string, unknown>;

    @Column({ name: "actualizado_por", type: "uuid", nullable: true })
    actualizadoPor: string | null;

    @Column({ name: "fecha_actualizacion", type: "timestamp" })
    fechaActualizacion: Date;
}
