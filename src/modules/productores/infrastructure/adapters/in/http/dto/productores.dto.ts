import { Equals, IsBoolean, IsIn, IsOptional, IsString, Length, MaxLength } from "class-validator";
import { Transform } from "class-transformer";
import type { EstadoProductor } from "../../../../../domain/entities/productor.entity";

const ESTADOS_PRODUCTOR: EstadoProductor[] = ["registrado", "validado"];

// Lo envía la app móvil tras el primer login por OTP
export class CompletarPerfilProductorDto {
    @IsString({ message: "El nombre debe ser un texto." })
    @Length(3, 150, { message: "El nombre debe tener entre 3 y 150 caracteres." })
    nombre: string;

    @IsString({ message: "La finca debe ser un texto." })
    @Length(2, 150, { message: "La finca debe tener entre 2 y 150 caracteres." })
    finca: string;

    @IsString({ message: "La vereda debe ser un texto." })
    @Length(2, 100, { message: "La vereda debe tener entre 2 y 100 caracteres." })
    vereda: string;

    @IsString({ message: "El municipio debe ser un texto." })
    @Length(2, 100, { message: "El municipio debe tener entre 2 y 100 caracteres." })
    municipio: string;

    @IsBoolean({ message: "El consentimiento debe ser true o false." })
    consentimiento: boolean;
}

export class ConsultarProductoresDto {
    @IsOptional()
    @IsIn(ESTADOS_PRODUCTOR, { message: `El estado debe ser uno de: ${ESTADOS_PRODUCTOR.join(", ")}` })
    estado?: EstadoProductor;

    // Llega como texto en la query (?consentimiento=false también es un filtro válido)
    @IsOptional()
    @Transform(({ value }: { value: unknown }) => (value === "true" ? true : value === "false" ? false : value))
    @IsBoolean({ message: "consentimiento debe ser true o false" })
    consentimiento?: boolean;

    @IsOptional()
    @IsString()
    @MaxLength(100)
    municipio?: string;

    // RF-03.5: texto libre sobre nombre o finca
    @IsOptional()
    @IsString()
    @MaxLength(150)
    busqueda?: string;
}

// RF-10.3: la revocación solo procede con confirmación explícita
export class RevocarConsentimientoDto {
    @Equals(true, { message: "Debes confirmar explícitamente la revocación del consentimiento." })
    confirmacion: boolean;
}
