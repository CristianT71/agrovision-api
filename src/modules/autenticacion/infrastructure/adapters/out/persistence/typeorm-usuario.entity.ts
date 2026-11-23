import { Entity, PrimaryColumn, Column } from "typeorm";

@Entity("usuarios")
export class TypeOrmUsuarioEntity {
    @PrimaryColumn("uuid")
    id: string;

    @Column({ type: "varchar", length: 20, unique: true })
    telefono: string;

    @Column({ type: "varchar", length: 20, default: "productor" })
    rol: string;

    @Column({ type: "varchar", length: 20, default: "activo" })
    estado: string;

    // Dirección para avisos por correo (opcional) y si la persona los quiere
    @Column({ type: "varchar", length: 150, nullable: true })
    correo: string | null;

    @Column({ name: "correo_notificaciones", type: "boolean", default: false })
    correoNotificaciones: boolean;

    // Habeas data: política de tratamiento de datos que la persona aceptó (null si no ha aceptado o la revocó)
    @Column({ name: "politica_datos_version", type: "varchar", length: 20, nullable: true })
    politicaDatosVersion: string | null;

    @Column({ name: "politica_datos_fecha", type: "timestamp", nullable: true })
    politicaDatosFecha: Date | null;

    @Column({ name: "fecha_registro", type: "timestamp" })
    fechaRegistro: Date;
}
