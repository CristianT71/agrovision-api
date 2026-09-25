import { IsIn, IsNotEmpty, IsString, MaxLength, MinLength } from "class-validator";
import { TIPOS_RESULTADO, type TipoResultado } from "../../../../../domain/entities/solicitud.entity";

// RF-04.5 / RF-04.7: la evaluación humana exige los tres campos completos
export class ResolverSolicitudDto {
    @IsString({ message: "La respuesta profesional debe ser una cadena de texto." })
    @MinLength(10, { message: "La respuesta profesional debe tener al menos 10 caracteres." })
    respuestaProfesional: string;

    @IsIn(TIPOS_RESULTADO, { message: `El tipo de resultado debe ser uno de: ${TIPOS_RESULTADO.join(", ")}` })
    tipoResultado: TipoResultado;

    @IsString({ message: "La plaga identificada debe ser una cadena de texto." })
    @IsNotEmpty({ message: "La plaga identificada no puede estar vacía." })
    @MaxLength(150, { message: "La plaga identificada no puede superar 150 caracteres." })
    plagaIdentificada: string;
}
