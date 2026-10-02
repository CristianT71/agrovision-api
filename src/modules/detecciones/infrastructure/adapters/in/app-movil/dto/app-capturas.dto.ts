import {
    ArrayMaxSize,
    ArrayMinSize,
    IsArray,
    IsBoolean,
    IsIn,
    IsInt,
    IsNumber,
    IsOptional,
    IsString,
    IsUUID,
    MaxLength,
    Min,
    ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import {
    CULTIVOS,
    ORGANOS,
    type Cultivo,
    type Organo,
} from "../../../../../../solicitudes/domain/entities/solicitud.entity";
import { RESULTADOS_COMPUERTA, type ResultadoCompuerta } from "../../../../../domain/services/categoria-biologica";
import { MAX_CAPTURAS_POR_LOTE } from "../../../../../domain/ports/in/recibir-capturas.port";

// Contrato de la app móvil (CaptureDto en Kotlin): los nombres en inglés no se cambian.
// La app omite los campos nulos (explicitNulls = false), por eso casi todo es opcional.
// Aquí solo se valida la forma; las reglas de cada captura las aplica el dominio para
// rechazar esa captura sin tumbar el resto del lote.

export class UbicacionCapturaDto {
    @IsNumber({}, { message: "latitude debe ser un número." })
    latitude: number;

    @IsNumber({}, { message: "longitude debe ser un número." })
    longitude: number;

    @IsOptional()
    @IsNumber({}, { message: "accuracyMeters debe ser un número." })
    accuracyMeters?: number | null;
}

export class CapturaAppDto {
    @IsUUID("all", { message: "El id de cada captura debe ser un UUID." })
    id: string;

    // Epoch en milisegundos
    @IsInt({ message: "capturedAt debe ser un epoch en milisegundos." })
    @Min(0, { message: "capturedAt debe ser un epoch en milisegundos." })
    capturedAt: number;

    @IsString({ message: "modelVersion es obligatorio." })
    @MaxLength(30, { message: "modelVersion no puede superar 30 caracteres." })
    modelVersion: string;

    @IsOptional()
    @IsString({ message: "predictedClassId debe ser texto." })
    @MaxLength(100, { message: "predictedClassId no puede superar 100 caracteres." })
    predictedClassId?: string | null;

    @IsOptional()
    @IsNumber({}, { message: "calibratedConfidence debe ser un número." })
    calibratedConfidence?: number | null;

    @IsNumber({}, { message: "oodScore debe ser un número." })
    oodScore: number;

    @IsIn(RESULTADOS_COMPUERTA, { message: `gateOutcome debe ser uno de: ${RESULTADOS_COMPUERTA.join(", ")}` })
    gateOutcome: ResultadoCompuerta;

    // 128 valores float16 en Base64 son ~350 caracteres; el límite deja margen a modelos mayores
    @IsOptional()
    @IsString({ message: "embedding debe ser texto en Base64." })
    @MaxLength(8192, { message: "embedding es demasiado largo." })
    embedding?: string | null;

    @IsOptional()
    @IsString({ message: "userCorrectionClassId debe ser texto." })
    @MaxLength(100, { message: "userCorrectionClassId no puede superar 100 caracteres." })
    userCorrectionClassId?: string | null;

    @IsBoolean({ message: "userConfirmed debe ser true o false." })
    userConfirmed: boolean;

    @IsOptional()
    @IsIn(CULTIVOS, { message: `cropType debe ser uno de: ${CULTIVOS.join(", ")}` })
    cropType?: Cultivo | null;

    @IsOptional()
    @IsIn(ORGANOS, { message: `plantOrgan debe ser uno de: ${ORGANOS.join(", ")}` })
    plantOrgan?: Organo | null;

    @IsOptional()
    @ValidateNested()
    @Type(() => UbicacionCapturaDto)
    location?: UbicacionCapturaDto | null;
}

export class LoteCapturasAppDto {
    @IsArray({ message: "captures debe ser una lista." })
    @ArrayMinSize(1, { message: "El lote debe traer al menos una captura." })
    @ArrayMaxSize(MAX_CAPTURAS_POR_LOTE, {
        message: `Un lote admite como máximo ${MAX_CAPTURAS_POR_LOTE} capturas.`,
    })
    @ValidateNested({ each: true })
    @Type(() => CapturaAppDto)
    captures: CapturaAppDto[];
}
