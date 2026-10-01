import { IsIn, IsOptional, IsString, Matches, MaxLength } from "class-validator";
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
