import { IsOptional, IsString, Matches, MaxLength } from "class-validator";

export class CatalogoSyncQueryDto {
    @IsOptional()
    @IsString()
    @MaxLength(13)
    @Matches(/^(0|[1-9]\d{0,12})$/, { message: "since debe ser epoch ms como texto entero no negativo." })
    since?: string;
}
