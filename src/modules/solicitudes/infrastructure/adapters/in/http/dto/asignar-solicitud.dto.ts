import { IsBoolean, IsOptional, IsUUID } from "class-validator";

// RF-08.3: el administrador delega el caso a un agrónomo
export class AsignarSolicitudDto {
    @IsUUID("4", { message: "El agronomoId debe ser un UUID válido." })
    agronomoId: string;

    // RF-08.4: confirma asignar aunque el agrónomo supere la carga máxima configurada
    @IsOptional()
    @IsBoolean({ message: "confirmarSobrecarga debe ser true o false." })
    confirmarSobrecarga?: boolean;
}
