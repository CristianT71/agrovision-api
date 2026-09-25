import { IsOptional, IsIn, IsUUID, IsBoolean } from "class-validator";
import { Transform } from "class-transformer";
import { ESTADOS_SOLICITUD, type EstadoSolicitud } from "../../../../domain/entities/solicitud.entity";

export class ConsultarSolicitudesDto {
    @IsOptional()
    @IsIn(ESTADOS_SOLICITUD, {
        message: `El estado debe ser uno de: ${ESTADOS_SOLICITUD.join(", ")}`,
    })
    estado?: EstadoSolicitud;

    @IsOptional()
    @IsUUID("4", { message: "El agronomoId debe ser un UUID válido" })
    agronomoId?: string;

    // Llega como texto en la query (?soloMias=true)
    @IsOptional()
    @Transform(({ value }) => value === true || value === "true")
    @IsBoolean({ message: "soloMias debe ser true o false" })
    soloMias?: boolean;
}
