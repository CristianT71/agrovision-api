import { IsNotEmpty, IsString } from "class-validator";

export class ResolverSolicitudDto {
    @IsString({ message: "La respuesta profesional debe ser una cadena de texto." })
    @IsNotEmpty({ message: "La respuesta profesional no puede estar vacía." })
    respuestaProfesional: string;

    @IsString({ message: "El tipo de resultado debe ser una cadena de texto." })
    @IsNotEmpty({ message: "El tipo de resultado no puede estar vacío." })
    tipoResultado: string;
}
