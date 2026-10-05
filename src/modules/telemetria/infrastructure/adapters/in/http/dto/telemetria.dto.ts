import { Type } from "class-transformer";
import { IsDate, IsOptional } from "class-validator";

// GET /telemetria/resumen?desde=2026-10-01&hasta=2026-10-05 (fechas ISO)
export class ConsultarResumenTelemetriaDto {
    @IsOptional()
    @Type(() => Date)
    @IsDate({ message: "desde debe ser una fecha válida." })
    desde?: Date;

    @IsOptional()
    @Type(() => Date)
    @IsDate({ message: "hasta debe ser una fecha válida." })
    hasta?: Date;
}
