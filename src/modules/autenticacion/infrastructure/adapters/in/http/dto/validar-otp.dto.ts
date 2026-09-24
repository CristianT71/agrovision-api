import { IsNotEmpty, IsString, IsIn, Matches } from "class-validator";
import { FORMATO_TELEFONO } from "./solicitar-otp.dto";

export class ValidarOtpDto {
    @IsString({ message: "El teléfono debe ser un texto." })
    @IsNotEmpty({ message: "El número de teléfono es obligatorio." })
    @Matches(FORMATO_TELEFONO, {
        message: "El teléfono debe incluir un formato internacional válido (+57...).",
    })
    telefono: string;

    @IsString()
    @Matches(/^\d{6}$/, { message: "El código OTP debe tener exactamente 6 dígitos." })
    codigo: string;

    @IsString()
    @IsIn(["admin", "agronomo", "productor"], { message: "El rol seleccionado no es válido." })
    rolSeleccionado: "admin" | "agronomo" | "productor";
}
