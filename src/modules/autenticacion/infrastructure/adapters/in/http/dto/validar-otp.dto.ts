import { IsNotEmpty, IsString, Length, IsIn } from "class-validator";

export class ValidarOtpDto {
    @IsString()
    @IsNotEmpty()
    telefono: string;

    @IsString()
    @Length(6, 6, { message: "El código OTP debe tener exactamente 6 dígitos." })
    codigo: string;

    @IsString()
    @IsIn(["admin", "agronomo", "productor"], { message: "El rol seleccionado no es válido." })
    rolSeleccionado: "admin" | "agronomo" | "productor";
}
