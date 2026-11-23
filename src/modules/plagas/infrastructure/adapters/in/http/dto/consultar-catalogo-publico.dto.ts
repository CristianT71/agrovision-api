import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import { TIPOS_PLAGA, type TipoPlaga } from "../../../../../domain/entities/plaga.entity";

// Filtros del catálogo público. Son opcionales y se pueden combinar.
export class ConsultarCatalogoPublicoDto {
    @IsOptional()
    @IsIn(TIPOS_PLAGA, { message: `El tipo debe ser uno de: ${TIPOS_PLAGA.join(", ")}` })
    tipo?: TipoPlaga;

    // Texto libre sobre nombre común, nombre científico y sinónimos
    @IsOptional()
    @IsString({ message: "La búsqueda debe ser un texto." })
    @MaxLength(100, { message: "La búsqueda admite hasta 100 caracteres." })
    q?: string;
}
