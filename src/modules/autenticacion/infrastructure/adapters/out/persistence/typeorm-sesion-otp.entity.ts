import { Entity, PrimaryColumn, Column } from "typeorm";

@Entity("sesiones_otp")
export class TypeOrmSesionOtpEntity {
    @PrimaryColumn("uuid")
    id: string;

    @Column({ name: "usuario_id", type: "uuid" })
    usuarioId: string;

    @Column({ type: "varchar", length: 6 })
    codigo: string;

    @Column({ name: "expira_en", type: "timestamp" })
    expiraEn: Date;

    @Column({ type: "boolean", default: false })
    usado: boolean;

    @Column({ name: "creado_en", type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
    creadoEn: Date;
}
