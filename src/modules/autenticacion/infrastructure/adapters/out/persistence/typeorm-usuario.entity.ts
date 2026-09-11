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

    @Column({ name: "fecha_registro", type: "timestamp" })
    fechaRegistro: Date;
}
