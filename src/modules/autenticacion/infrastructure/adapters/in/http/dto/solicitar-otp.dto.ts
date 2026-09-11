import { IsNotEmpty, IsString, Matches } from "class-validator";

export class SolicitarOtpDto {
    @IsString({ message: "El teléfono debe ser un texto." })
    @IsNotEmpty({ message: "El número de teléfono es obligatorio." })
    @Matches(/^\+?[1-9]\d{1,14}$/, {
        message: "El teléfono debe incluir un formato internacional válido (+57...).",
    })
    telefono: string;
}
