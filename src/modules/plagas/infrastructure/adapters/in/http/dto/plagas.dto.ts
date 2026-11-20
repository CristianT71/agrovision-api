import {
    ArrayMaxSize,
    ArrayMinSize,
    IsArray,
    IsBoolean,
    IsIn,
    IsNotEmpty,
    IsOptional,
    IsString,
    MaxLength,
} from "class-validator";
import { Transform } from "class-transformer";
import { OmitibleNoNulo } from "../../../../../../../common/validators/omitible-no-nulo";
import { TIPOS_PLAGA, type TipoPlaga } from "../../../../../domain/entities/plaga.entity";

const MENSAJE_TIPO = `El tipo debe ser uno de: ${TIPOS_PLAGA.join(", ")}`;

// RF-05.4: taxonomía, fisiología afectada y medidas de contención son obligatorias
export class CrearPlagaDto {
    @IsString()
    @IsNotEmpty({ message: "El nombre común es obligatorio." })
    @MaxLength(150)
    nombreComun: string;

    // Opcional: una ficha "sano" o una deficiencia no siempre tiene nombre científico
    @IsOptional()
    @IsString()
    @MaxLength(150)
    nombreCientifico?: string | null;

    @IsIn(TIPOS_PLAGA, { message: MENSAJE_TIPO })
    tipo: TipoPlaga;

    @IsString()
    @IsNotEmpty({ message: "La descripción es obligatoria." })
    descripcion: string;

    @IsString()
    @IsNotEmpty({ message: "Los síntomas son obligatorios." })
    sintomas: string;

    @OmitibleNoNulo()
    @IsString()
    @MaxLength(100)
    cultivo?: string;

    @IsArray()
    @ArrayMinSize(1, { message: "Debe indicar al menos un órgano afectado." })
    @ArrayMaxSize(20)
    @IsString({ each: true })
    @MaxLength(100, { each: true })
    organosAfectados: string[];

    // RF-05.5: listas dinámicas
    @OmitibleNoNulo()
    @IsArray()
    @ArrayMaxSize(50)
    @IsString({ each: true })
    @MaxLength(150, { each: true })
    hospederos?: string[];

    @IsString()
    @IsNotEmpty({ message: "Las medidas de contención son obligatorias." })
    medidasContencion: string;

    @OmitibleNoNulo()
    @IsArray()
    @ArrayMaxSize(50)
    @IsString({ each: true })
    @MaxLength(150, { each: true })
    sinonimos?: string[];
}

// RF-05.3: todos los campos son opcionales, pero si llegan no pueden venir vacíos ni en null
// (salvo el nombre científico, que admite null para borrarlo)
export class ActualizarPlagaDto {
    @OmitibleNoNulo()
    @IsString()
    @IsNotEmpty({ message: "El nombre común no puede quedar vacío." })
    @MaxLength(150)
    nombreComun?: string;

    @IsOptional()
    @IsString()
    @MaxLength(150)
    nombreCientifico?: string | null;

    @OmitibleNoNulo()
    @IsIn(TIPOS_PLAGA, { message: MENSAJE_TIPO })
    tipo?: TipoPlaga;

    @OmitibleNoNulo()
    @IsString()
    @IsNotEmpty({ message: "La descripción no puede quedar vacía." })
    descripcion?: string;

    @OmitibleNoNulo()
    @IsString()
    @IsNotEmpty({ message: "Los síntomas no pueden quedar vacíos." })
    sintomas?: string;

    @OmitibleNoNulo()
    @IsString()
    @MaxLength(100)
    cultivo?: string;

    @OmitibleNoNulo()
    @IsArray()
    @ArrayMinSize(1, { message: "Debe indicar al menos un órgano afectado." })
    @ArrayMaxSize(20)
    @IsString({ each: true })
    @MaxLength(100, { each: true })
    organosAfectados?: string[];

    @OmitibleNoNulo()
    @IsArray()
    @ArrayMaxSize(50)
    @IsString({ each: true })
    @MaxLength(150, { each: true })
    hospederos?: string[];

    @OmitibleNoNulo()
    @IsString()
    @IsNotEmpty({ message: "Las medidas de contención no pueden quedar vacías." })
    medidasContencion?: string;

    @OmitibleNoNulo()
    @IsArray()
    @ArrayMaxSize(50)
    @IsString({ each: true })
    @MaxLength(150, { each: true })
    sinonimos?: string[];
}

export class ConsultarPlagasDto {
    @IsOptional()
    @IsIn(TIPOS_PLAGA, { message: MENSAJE_TIPO })
    tipo?: TipoPlaga;

    // RF-05.2: texto libre sobre nombre común, científico y sinónimos
    @IsOptional()
    @IsString()
    @MaxLength(150)
    busqueda?: string;

    // Llega como texto en la query (?conAval=false también es un filtro válido)
    @IsOptional()
    @Transform(({ value }: { value: unknown }) => (value === "true" ? true : value === "false" ? false : value))
    @IsBoolean({ message: "conAval debe ser true o false" })
    conAval?: boolean;
}

// RF-05.6: parámetros químicos y de dosificación de la ficha avalada
export class ActualizarProtocoloQuimicoDto {
    @IsString()
    @IsNotEmpty({ message: "El protocolo químico no puede estar vacío." })
    protocoloQuimico: string;
}
