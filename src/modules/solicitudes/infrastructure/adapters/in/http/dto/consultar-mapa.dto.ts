import { IsDate, IsIn, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";
import { Type } from "class-transformer";
import {
    CULTIVOS,
    ESTADOS_SOLICITUD,
    type Cultivo,
    type EstadoSolicitud,
} from "../../../../../domain/entities/solicitud.entity";

// Filtros del mapa de casos. No hay paginación: el servidor devuelve como máximo 500 puntos y avisa si recortó.
export class ConsultarMapaDto {
    @IsOptional()
    @IsIn(ESTADOS_SOLICITUD, { message: `El estado debe ser uno de: ${ESTADOS_SOLICITUD.join(", ")}` })
    estado?: EstadoSolicitud;

    @IsOptional()
    @IsUUID("4", { message: "El agronomoId debe ser un UUID válido" })
    agronomoId?: string;

    @IsOptional()
    @IsIn(CULTIVOS, { message: `El cultivo debe ser uno de: ${CULTIVOS.join(", ")}` })
    cultivo?: Cultivo;

    @IsOptional()
    @IsString()
    @MaxLength(100)
    municipio?: string;

    // Fechas ISO 8601 (?desde=2026-01-01)
    @IsOptional()
    @Type(() => Date)
    @IsDate({ message: "desde debe ser una fecha válida." })
    desde?: Date;

    @IsOptional()
    @Type(() => Date)
    @IsDate({ message: "hasta debe ser una fecha válida." })
    hasta?: Date;
}
