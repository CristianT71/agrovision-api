import { IsOptional, IsString, MaxLength } from "class-validator";
import { MAX_LONGITUD_MENSAJE } from "../../../../../domain/entities/mensaje.entity";

// El texto es opcional porque un mensaje puede ser solo adjuntos (RF-08.5).
// La regla "texto o al menos un adjunto" la valida el dominio, no el DTO.
export class EnviarMensajeDto {
    @IsOptional()
    @IsString()
    @MaxLength(MAX_LONGITUD_MENSAJE)
    contenido?: string;
}
