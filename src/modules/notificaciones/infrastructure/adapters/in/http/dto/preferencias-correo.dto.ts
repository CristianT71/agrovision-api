import { IsBoolean, IsEmail, IsOptional, MaxLength } from "class-validator";

export class GuardarPreferenciaCorreoDto {
    @IsBoolean({ message: "activo debe ser true o false" })
    activo: boolean;

    @IsOptional()
    @IsEmail({}, { message: "El correo no es válido" })
    @MaxLength(150, { message: "El correo no puede superar 150 caracteres" })
    correo?: string | null;
}
