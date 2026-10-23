import { IsIn, IsOptional } from "class-validator";
import { TelefonoInternacional } from "../../../../../../../common/validators/telefono-internacional";

export class SolicitarOtpDto {
    // RF-01.3: se normaliza a E.164 y solo se admiten los prefijos +57, +1, +52, +51 y +593
    @TelefonoInternacional()
    telefono: string;

    @IsOptional()
    @IsIn(["admin", "agronomo", "productor"], { message: "El rol seleccionado no es válido." })
    rolSeleccionado?: "admin" | "agronomo" | "productor";
}
