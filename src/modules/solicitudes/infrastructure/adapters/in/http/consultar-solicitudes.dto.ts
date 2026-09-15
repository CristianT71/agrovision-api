import { IsOptional, IsString, IsIn, IsUUID } from "class-validator";
import type { EstadoSolicitud } from "../../../../domain/entities/solicitud.entity";

export class ConsultarSolicitudesDto {
    @IsOptional()
    @IsString()
    @IsIn(["Pendiente", "Resuelta"], {
        message: "El estado debe ser Pendiente o Resuelta",
    })
    estado?: EstadoSolicitud;

    @IsOptional()
    @IsUUID("4", { message: "El agronomoId debe ser un UUID válido" })
    agronomoId?: string;
}
