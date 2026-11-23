import { IsIn, IsOptional, IsString, Matches } from "class-validator";
import { TelefonoInternacional } from "../../../../../../../common/validators/telefono-internacional";

export class ValidarOtpDto {
    @TelefonoInternacional()
    telefono: string;

    @IsString()
    @Matches(/^\d{6}$/, { message: "El código OTP debe tener exactamente 6 dígitos." })
    codigo: string;

    @IsOptional()
    @IsIn(["productor"], { message: "El rol seleccionado no es válido." })
    rolSeleccionado?: "productor";
}
