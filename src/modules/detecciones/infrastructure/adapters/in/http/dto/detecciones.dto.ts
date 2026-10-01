import {
    IsArray,
    IsBoolean,
    IsDateString,
    IsIn,
    IsInt,
    IsOptional,
    IsString,
    Max,
    MaxLength,
    Min,
} from "class-validator";
import { Transform, Type } from "class-transformer";
import { CATEGORIAS, type Categoria } from "../../../../../domain/services/categoria-biologica";
import { ESTADOS_REVISION, type EstadoRevision } from "../../../../../domain/services/divergencia";

// Las listas llegan separadas por comas en la query (?incluir=enfermedad,plaga)
const aLista = ({ value }: { value: unknown }) =>
    typeof value === "string"
        ? value
              .split(",")
              .map((parte) => parte.trim())
              .filter(Boolean)
        : value;

// Los booleanos llegan como texto (?defectuosas=false también es un filtro válido)
const aBooleano = ({ value }: { value: unknown }) => (value === "true" ? true : value === "false" ? false : value);

// Filtros comunes al listado y al resumen del monitor (RF-07.2 a RF-07.4)
export class FiltrosDeteccionesDto {
    @IsOptional()
    @Transform(aLista)
    @IsArray({ message: "incluir debe ser una lista separada por comas." })
    @IsIn(CATEGORIAS, { each: true, message: `incluir admite: ${CATEGORIAS.join(", ")}` })
    incluir?: Categoria[];

    @IsOptional()
    @Transform(aLista)
    @IsArray({ message: "excluir debe ser una lista separada por comas." })
    @IsIn(CATEGORIAS, { each: true, message: `excluir admite: ${CATEGORIAS.join(", ")}` })
    excluir?: Categoria[];

    // RF-07.3: divergente (un humano corrigió a la máquina), coincide o sin_revision
    @IsOptional()
    @IsIn(ESTADOS_REVISION, { message: `revision debe ser uno de: ${ESTADOS_REVISION.join(", ")}` })
    revision?: EstadoRevision;

    // RF-07.4: inferencias con confianza absoluta de cero
    @IsOptional()
    @Transform(aBooleano)
    @IsBoolean({ message: "defectuosas debe ser true o false." })
    defectuosas?: boolean;

    @IsOptional()
    @IsString()
    @MaxLength(30)
    modeloVersion?: string;

    @IsOptional()
    @IsString()
    @MaxLength(100)
    municipio?: string;

    @IsOptional()
    @IsDateString({}, { message: "desde debe ser una fecha ISO (2026-09-01)." })
    desde?: string;

    @IsOptional()
    @IsDateString({}, { message: "hasta debe ser una fecha ISO (2026-09-30)." })
    hasta?: string;
}

export class ConsultarDeteccionesDto extends FiltrosDeteccionesDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: "La página debe ser un número entero." })
    @Min(1, { message: "La página empieza en 1." })
    pagina: number = 1;

    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: "El límite debe ser un número entero." })
    @Min(1, { message: "El límite debe ser al menos 1." })
    @Max(100, { message: "El límite no puede superar 100." })
    limite: number = 20;
}
