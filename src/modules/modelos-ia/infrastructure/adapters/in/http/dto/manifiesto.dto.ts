import { IsIn, IsOptional, IsString, Length, Matches, MaxLength } from "class-validator";
import { FORMATO_VERSION } from "../../../../../domain/entities/modelo-ia.entity";
import { ARTEFACTOS, type Artefacto } from "../../../../../domain/ports/in/manifiesto-modelos.port";

// Query que envía la app (PublicApiService.currentModel): ?platform=android&appVersion=&deviceId=
export class ConsultarManifiestoDto {
    @IsOptional()
    @IsIn(["android"], { message: "platform solo admite android." })
    platform?: "android";

    @IsString({ message: "appVersion es obligatorio." })
    @MaxLength(50, { message: "appVersion no puede superar 50 caracteres." })
    appVersion: string;

    @IsString({ message: "deviceId es obligatorio." })
    @Length(1, 128, { message: "deviceId debe tener entre 1 y 128 caracteres." })
    deviceId: string;
}

export class ArtefactoParamsDto {
    @Matches(FORMATO_VERSION, { message: "La versión debe tener el formato 1.2.3." })
    version: string;

    @IsIn(ARTEFACTOS, { message: `El artefacto debe ser uno de: ${ARTEFACTOS.join(", ")}` })
    artefacto: Artefacto;
}
