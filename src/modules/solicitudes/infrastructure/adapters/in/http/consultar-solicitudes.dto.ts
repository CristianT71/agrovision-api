import { IsOptional, IsIn, IsUUID, IsBoolean, IsString, MaxLength, IsInt, Min, Max } from "class-validator";
import { Transform, Type } from "class-transformer";
import { ESTADOS_SOLICITUD, type EstadoSolicitud } from "../../../../domain/entities/solicitud.entity";
import {
    LIMITE_POR_DEFECTO,
    MAX_LIMITE,
    PAGINA_POR_DEFECTO,
} from "../../../../domain/ports/in/consultar-solicitudes.port";

export class ConsultarSolicitudesDto {
    @IsOptional()
    @IsIn(ESTADOS_SOLICITUD, {
        message: `El estado debe ser uno de: ${ESTADOS_SOLICITUD.join(", ")}`,
    })
    estado?: EstadoSolicitud;

    // Solo administrador: al agrónomo siempre se le filtra por su propio perfil
    @IsOptional()
    @IsUUID("4", { message: "El agronomoId debe ser un UUID válido" })
    agronomoId?: string;

    // Solo administrador (RF-08.2): las "Enviada" sin agrónomo. Llega como texto (?sinAsignar=true)
    @IsOptional()
    @Transform(({ value }) => value === true || value === "true")
    @IsBoolean({ message: "sinAsignar debe ser true o false" })
    sinAsignar?: boolean;

    // RF-03.5: nombre del productor, finca, vereda, municipio o código SOL-XXXXXXXX
    @IsOptional()
    @IsString()
    @MaxLength(100)
    busqueda?: string;

    // RNF-03.1: paginación en el servidor, igual que /detecciones
    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: "La página debe ser un número entero." })
    @Min(1, { message: "La página empieza en 1." })
    pagina: number = PAGINA_POR_DEFECTO;

    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: "El límite debe ser un número entero." })
    @Min(1, { message: "El límite debe ser al menos 1." })
    @Max(MAX_LIMITE, { message: `El límite no puede superar ${MAX_LIMITE}.` })
    limite: number = LIMITE_POR_DEFECTO;
}
