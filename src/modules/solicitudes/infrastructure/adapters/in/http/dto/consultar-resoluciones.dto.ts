import { Type } from "class-transformer";
import { IsDate, IsOptional } from "class-validator";

// GET /solicitudes/resoluciones?desde=2026-09-05&hasta=2026-10-05 (fechas ISO), como /telemetria/resumen
export class ConsultarResolucionesDto {
    @IsOptional()
    @Type(() => Date)
    @IsDate({ message: "desde debe ser una fecha válida." })
    desde?: Date;

    @IsOptional()
    @Type(() => Date)
    @IsDate({ message: "hasta debe ser una fecha válida." })
    hasta?: Date;
}
