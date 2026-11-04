import { IsString, Length } from "class-validator";

export class AceptarPoliticaDatosDto {
    @IsString()
    @Length(1, 20, { message: "La versión de la política no es válida." })
    version: string;
}
