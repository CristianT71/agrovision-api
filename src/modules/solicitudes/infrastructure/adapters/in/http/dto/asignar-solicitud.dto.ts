import { IsUUID } from "class-validator";

// RF-08.3: el administrador delega el caso a un agrónomo
export class AsignarSolicitudDto {
    @IsUUID("4", { message: "El agronomoId debe ser un UUID válido." })
    agronomoId: string;
}
