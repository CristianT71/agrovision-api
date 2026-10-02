import { IsInt, IsOptional, Max, Min } from "class-validator";
import { Type } from "class-transformer";

export class CasosSimilaresDto {
    // RF-04.3 pide al menos 3 expedientes; se permiten hasta 10
    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: "limite debe ser un número entero" })
    @Min(1)
    @Max(10)
    limite?: number;
}
