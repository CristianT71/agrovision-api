import { IsEmail, IsIn, IsNotEmpty, IsString, Length, Matches } from "class-validator";
import { ESPECIALIDADES } from "../../../../../domain/entities/agronomo.entity";
import { FORMATO_TELEFONO } from "../../../../../../autenticacion/infrastructure/adapters/in/http/dto/solicitar-otp.dto";

// Llega como multipart/form-data junto a los documentos (RF-01.6, RF-10.4)
export class RegistrarAgronomoDto {
    @IsString({ message: "El nombre debe ser un texto." })
    @Length(3, 150, { message: "El nombre debe tener entre 3 y 150 caracteres." })
    nombre: string;

    @IsString({ message: "El teléfono debe ser un texto." })
    @IsNotEmpty({ message: "El número de celular es obligatorio." })
    @Matches(FORMATO_TELEFONO, {
        message: "El teléfono debe incluir un formato internacional válido (+57...).",
    })
    telefono: string;

    @IsEmail({}, { message: "El correo electrónico no es válido." })
    correo: string;

    @IsString({ message: "La tarjeta profesional debe ser un texto." })
    @Length(4, 50, { message: "La tarjeta profesional debe tener entre 4 y 50 caracteres." })
    tarjetaProfesional: string;

    @IsIn(ESPECIALIDADES, { message: `La especialidad debe ser una de: ${ESPECIALIDADES.join(", ")}` })
    especialidad: string;
}
