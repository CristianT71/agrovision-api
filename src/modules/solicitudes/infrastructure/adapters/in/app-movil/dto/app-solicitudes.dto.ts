import {
    Allow,
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
import { CULTIVOS, ORGANOS, type Cultivo, type Organo } from "../../../../../domain/entities/solicitud.entity";
import { ANGULOS_FOTO, type AnguloFoto } from "../../../../../domain/entities/foto-solicitud.entity";
import { MAX_SOLICITUDES_POR_LOTE } from "../../../../../domain/ports/in/solicitudes-app.port";

// Contrato de la app móvil: los nombres en inglés no se cambian.
// Aquí solo se valida la forma; las reglas de cada solicitud (2 a 5 fotos, nota, coordenadas)
// las aplica el dominio para rechazar esa solicitud sin tumbar el resto del lote.

export const PRECISIONES_UBICACION = ["exact", "coarse"] as const;
export type PrecisionUbicacion = (typeof PRECISIONES_UBICACION)[number];

export class UbicacionAppDto {
    @IsNumber({}, { message: "latitude debe ser un número." })
    latitude: number;

    @IsNumber({}, { message: "longitude debe ser un número." })
    longitude: number;

    @IsOptional()
    @IsNumber({}, { message: "accuracyMeters debe ser un número." })
    accuracyMeters?: number | null;

    // exact = ubicación fina; coarse = aproximada. Una solicitud de revisión solo se acepta con exact
    // (el dominio la rechaza con "ubicacion_exacta_requerida"). Las capturas no usan este DTO.
    @IsOptional()
    @IsIn(PRECISIONES_UBICACION, { message: `precision debe ser uno de: ${PRECISIONES_UBICACION.join(", ")}` })
    precision?: PrecisionUbicacion | null;

    // Metros sobre el nivel del mar que midió el GPS. El rango lo valida el dominio por solicitud.
    @IsOptional()
    @IsNumber({}, { message: "altitudeMeters debe ser un número." })
    altitudeMeters?: number | null;

    // El sistema operativo marcó la ubicación como simulada
    @IsOptional()
    @IsBoolean({ message: "mock debe ser true o false." })
    mock?: boolean | null;
}

export class ImagenAppDto {
    @IsUUID("all", { message: "El id de cada imagen debe ser un UUID." })
    id: string;

    @IsIn(ANGULOS_FOTO, { message: `angle debe ser uno de: ${ANGULOS_FOTO.join(", ")}` })
    angle: AnguloFoto;

    // La app puede enviarlo, pero el servidor todavía no lo usa
    @Allow()
    embedding?: unknown;
}

export class SolicitudAppDto {
    @IsUUID("all", { message: "El id de cada solicitud debe ser un UUID." })
    id: string;

    @IsOptional()
    @IsUUID("all", { message: "captureId debe ser un UUID." })
    captureId?: string | null;

    @IsOptional()
    @IsString({ message: "modelVersion debe ser texto." })
    @MaxLength(30, { message: "modelVersion no puede superar 30 caracteres." })
    modelVersion?: string | null;

    @IsIn(CULTIVOS, { message: `cropType debe ser uno de: ${CULTIVOS.join(", ")}` })
    cropType: Cultivo;

    @IsIn(ORGANOS, { message: `plantOrgan debe ser uno de: ${ORGANOS.join(", ")}` })
    plantOrgan: Organo;

    @IsOptional()
    @IsString({ message: "noteText debe ser texto." })
    noteText?: string | null;

    // Epoch en milisegundos
    @IsInt({ message: "createdAt debe ser un epoch en milisegundos." })
    @Min(0, { message: "createdAt debe ser un epoch en milisegundos." })
    createdAt: number;

    @IsOptional()
    @ValidateNested()
    @Type(() => UbicacionAppDto)
    location?: UbicacionAppDto | null;

    @IsArray({ message: "images debe ser una lista." })
    @ValidateNested({ each: true })
    @Type(() => ImagenAppDto)
    images: ImagenAppDto[];
}

export class LoteSolicitudesAppDto {
    @IsArray({ message: "requests debe ser una lista." })
    @ArrayMinSize(1, { message: "El lote debe traer al menos una solicitud." })
    @ArrayMaxSize(MAX_SOLICITUDES_POR_LOTE, {
        message: `Un lote admite como máximo ${MAX_SOLICITUDES_POR_LOTE} solicitudes.`,
    })
    @ValidateNested({ each: true })
    @Type(() => SolicitudAppDto)
    requests: SolicitudAppDto[];
}

export class MisSolicitudesAppQueryDto {
    // Llega como texto en la query (?since=1719000000000)
    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: "since debe ser un epoch en milisegundos." })
    @Min(0, { message: "since debe ser un epoch en milisegundos." })
    since?: number;
}
