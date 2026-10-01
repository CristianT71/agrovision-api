import {
    ArrayMaxSize,
    IsArray,
    IsIn,
    IsNumber,
    IsOptional,
    IsString,
    Matches,
    Max,
    MaxLength,
    Min,
    MinLength,
    ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { MAX_LONGITUD_CLASE } from "../../../../../domain/entities/metrica-modelo.entity";
import {
    CANALES,
    FORMATO_VERSION,
    MAX_LONGITUD_NOTAS,
    type Canal,
} from "../../../../../domain/entities/modelo-ia.entity";

// Llega como multipart/form-data junto con los archivos modelo, etiquetas y calibracion (RF-09.5)
export class SubirModeloDto {
    @Matches(FORMATO_VERSION, { message: "La versión debe tener el formato 1.2.3." })
    version: string;

    @Matches(FORMATO_VERSION, { message: "La versión mínima de la app debe tener el formato 1.2.3." })
    versionMinApp: string;

    @IsOptional()
    @IsString({ message: "Las notas deben ser texto." })
    @MaxLength(MAX_LONGITUD_NOTAS, { message: `Las notas no pueden superar ${MAX_LONGITUD_NOTAS} caracteres.` })
    notas?: string;
}

export class ConsultarModelosDto {
    @IsOptional()
    @IsIn(CANALES, { message: `El canal debe ser uno de: ${CANALES.join(", ")}` })
    canal?: Canal;
}

// RF-09.2: los tres valores van de 0 a 1 (la memoria técnica los reporta así)
export class MetricaDto {
    @IsNumber({}, { message: "precision debe ser un número." })
    @Min(0, { message: "precision debe estar entre 0 y 1." })
    @Max(1, { message: "precision debe estar entre 0 y 1." })
    precision: number;

    @IsNumber({}, { message: "recall debe ser un número." })
    @Min(0, { message: "recall debe estar entre 0 y 1." })
    @Max(1, { message: "recall debe estar entre 0 y 1." })
    recall: number;

    @IsNumber({}, { message: "f1 debe ser un número." })
    @Min(0, { message: "f1 debe estar entre 0 y 1." })
    @Max(1, { message: "f1 debe estar entre 0 y 1." })
    f1: number;
}

export class MetricaClaseDto extends MetricaDto {
    @IsString({ message: "La clase debe ser texto." })
    @MinLength(1, { message: "La clase no puede estar vacía." })
    @MaxLength(MAX_LONGITUD_CLASE, { message: `La clase no puede superar ${MAX_LONGITUD_CLASE} caracteres.` })
    clase: string;
}

export class RegistrarMetricasDto {
    @ValidateNested()
    @Type(() => MetricaDto)
    global: MetricaDto;

    @IsOptional()
    @IsArray({ message: "porClase debe ser una lista." })
    @ArrayMaxSize(200, { message: "porClase admite como máximo 200 clases." })
    @ValidateNested({ each: true })
    @Type(() => MetricaClaseDto)
    porClase?: MetricaClaseDto[];
}
