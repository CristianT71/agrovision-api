import { IsString, IsIn, Matches } from "class-validator";
import { TelefonoInternacional } from "../../../../../../../common/validators/telefono-internacional";

export class ValidarOtpDto {
    @TelefonoInternacional()
    telefono: string;

    @IsString()
    @Matches(/^\d{6}$/, { message: "El código OTP debe tener exactamente 6 dígitos." })
    codigo: string;

    @IsString()
    @IsIn(["admin", "agronomo", "productor"], { message: "El rol seleccionado no es válido." })
    rolSeleccionado: "admin" | "agronomo" | "productor";
}
