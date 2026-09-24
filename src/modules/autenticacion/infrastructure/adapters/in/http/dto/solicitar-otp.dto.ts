import { IsNotEmpty, IsString, Matches } from "class-validator";

// Formato internacional E.164 (RF-01.3)
export const FORMATO_TELEFONO = /^\+?[1-9]\d{1,14}$/;

export class SolicitarOtpDto {
    @IsString({ message: "El teléfono debe ser un texto." })
    @IsNotEmpty({ message: "El número de teléfono es obligatorio." })
    @Matches(FORMATO_TELEFONO, {
        message: "El teléfono debe incluir un formato internacional válido (+57...).",
    })
    telefono: string;
}
