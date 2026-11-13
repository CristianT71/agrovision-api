import { Type } from "class-transformer";
import {
    ArrayMaxSize,
    IsArray,
    IsBoolean,
    IsIn,
    IsInt,
    IsNumber,
    IsOptional,
    IsString,
    Matches,
    Max,
    MaxLength,
    Min,
    ValidateNested,
} from "class-validator";
import { ESTADOS_REGLA, type EstadoRegla } from "../../../../../domain/entities/regla-zona";

// Identificador del tipo de enfermedad: minúsculas, dígitos, guion o guion bajo (p. ej. "roya").
export const PATRON_TIPO = /^[a-z0-9_-]{2,50}$/;
const MENSAJE_TIPO = "tipo debe tener entre 2 y 50 caracteres: minúsculas, dígitos, '-' o '_'.";
const NUMERO = { allowNaN: false, allowInfinity: false };

// Solo forma y tipos: los rangos y la coherencia de la tabla los valida el dominio (REGLA_INVALIDA).
export class FilaReglaDto {
    @IsInt() orden: number;
    @IsNumber(NUMERO) sevMax: number;
    @IsNumber(NUMERO) incMax: number;
    @IsNumber(NUMERO) radioMinM: number;
    @IsNumber(NUMERO) radioMaxM: number;
}

export class CrearReglaZonaDto {
    @IsString() @Matches(PATRON_TIPO, { message: MENSAJE_TIPO }) tipoEnfermedad: string;
    @IsOptional() @IsString() @MaxLength(5000) notas?: string | null;
    @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => FilaReglaDto) filas: FilaReglaDto[];
}

export class EditarReglaZonaDto {
    @IsOptional() @IsString() @MaxLength(5000) notas?: string | null;
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(50)
    @ValidateNested({ each: true })
    @Type(() => FilaReglaDto)
    filas?: FilaReglaDto[];
}

export class ConsultarReglasZonaDto {
    @IsOptional() @IsString() @Matches(PATRON_TIPO, { message: MENSAJE_TIPO }) tipo?: string;
    @IsOptional() @IsIn(ESTADOS_REGLA) estado?: EstadoRegla;
}

export class AprobarReglaZonaDto {
    @IsBoolean() calibrada: boolean;
    @IsOptional() @IsString() @MaxLength(2000) nota?: string | null;
}

export class SimularReglaZonaDto {
    @IsNumber(NUMERO) @Min(0) @Max(100) severidadPct: number;
    @IsNumber(NUMERO) @Min(0) @Max(100) incidenciaPct: number;
    @IsNumber(NUMERO) @Min(1) @Max(1_000_000) plantasPorHa: number;
}

export class ConsultaPublicaReglasZonaDto {
    @IsString({ message: "Falta el parámetro tipo." }) @Matches(PATRON_TIPO, { message: MENSAJE_TIPO }) tipo: string;
}
