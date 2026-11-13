import { Type } from "class-transformer";
import {
    IsDateString,
    IsIn,
    IsInt,
    IsOptional,
    IsString,
    Matches,
    Max,
    MaxLength,
    Min,
    ValidateIf,
} from "class-validator";
import { BANDAS, TIPOS_ARCHIVO, type Banda, type TipoArchivo } from "../../../../../domain/entities/vuelo";

export class CrearVueloDto {
    @IsString() @Matches(/\S/) @MaxLength(200) nombre: string;
    @IsOptional() @IsString() @MaxLength(200) lote?: string | null;
    @IsOptional() @IsString() @MaxLength(10000) notas?: string | null;
}
export class ActualizarVueloDto {
    @ValidateIf((_obj, valor) => valor !== undefined) @IsString() @Matches(/\S/) @MaxLength(200) nombre?: string;
    @IsOptional() @IsString() @MaxLength(200) lote?: string | null;
    @IsOptional() @IsString() @MaxLength(10000) notas?: string | null;
}
export class ConsultarVuelosDto {
    @IsOptional() @Type(() => Number) @IsInt() @Min(1) pagina?: number;
    @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limite?: number;
    @IsOptional() @IsString() @MaxLength(200) lote?: string;
    @IsOptional() @IsDateString() desde?: string;
    @IsOptional() @IsDateString() hasta?: string;
}
export class ConsultarArchivosDto {
    @IsOptional() @Type(() => Number) @IsInt() @Min(1) pagina?: number;
    @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limite?: number;
    @IsOptional() @IsIn(TIPOS_ARCHIVO) tipo?: TipoArchivo;
    @IsOptional() @IsIn(BANDAS) banda?: Banda;
}
