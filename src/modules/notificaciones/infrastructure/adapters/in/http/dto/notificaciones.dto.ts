import { IsBoolean, IsInt, IsOptional, Max, Min } from "class-validator";
import { Transform, Type } from "class-transformer";

export class ConsultarNotificacionesDto {
    // Llega como texto en la query (?soloNoLeidas=true)
    @IsOptional()
    @Transform(({ value }) => value === true || value === "true")
    @IsBoolean({ message: "soloNoLeidas debe ser true o false" })
    soloNoLeidas?: boolean;

    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: "La página debe ser un número entero" })
    @Min(1, { message: "La página debe ser mayor o igual a 1" })
    pagina: number = 1;

    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: "El límite debe ser un número entero" })
    @Min(1, { message: "El límite debe ser mayor o igual a 1" })
    @Max(50, { message: "El límite no puede superar 50" })
    limite: number = 20;
}
