import { IsIn, IsOptional } from "class-validator";
import { ESPECIALIDADES, type EstadoAgronomo } from "../../../../../domain/entities/agronomo.entity";

const ESTADOS_AGRONOMO: EstadoAgronomo[] = ["pendiente", "activo", "inactivo"];

export class ConsultarAgronomosDto {
    @IsOptional()
    @IsIn(ESTADOS_AGRONOMO, { message: `El estado debe ser uno de: ${ESTADOS_AGRONOMO.join(", ")}` })
    estado?: EstadoAgronomo;

    @IsOptional()
    @IsIn(ESPECIALIDADES, { message: `La especialidad debe ser una de: ${ESPECIALIDADES.join(", ")}` })
    especialidad?: string;
}
