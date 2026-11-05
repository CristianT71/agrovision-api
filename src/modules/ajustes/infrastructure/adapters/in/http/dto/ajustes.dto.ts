import { IsBoolean, IsIn, IsOptional } from "class-validator";
import {
    CARGAS_MAXIMAS,
    EXPIRACIONES,
    IDIOMAS,
    UMBRALES_PLAGA,
    ZONAS_HORARIAS,
    type AjustesPersonales,
    type AjustesSistema,
} from "../../../../../domain/ajustes";

const opcion = (lista: readonly string[]) => ({ message: `Debe ser uno de: ${lista.join(", ")}` });
const booleano = { message: "Debe ser true o false" };

// PATCH: todos los campos son opcionales, solo se cambia lo que llega
export class ActualizarAjustesPersonalesDto implements Partial<AjustesPersonales> {
    @IsOptional() @IsIn(IDIOMAS, opcion(IDIOMAS)) idioma?: string;
    @IsOptional() @IsIn(ZONAS_HORARIAS, opcion(ZONAS_HORARIAS)) zonaHoraria?: string;
    @IsOptional() @IsBoolean(booleano) pushNavegador?: boolean;
    @IsOptional() @IsBoolean(booleano) casosSinAsignar?: boolean;
    @IsOptional() @IsBoolean(booleano) alertaPlagaNueva?: boolean;
    @IsOptional() @IsBoolean(booleano) despliegues?: boolean;
    @IsOptional() @IsBoolean(booleano) fallosOTA?: boolean;
    @IsOptional() @IsBoolean(booleano) nuevasSolicitudes?: boolean;
}

export class ActualizarAjustesSistemaDto implements Partial<AjustesSistema> {
    @IsOptional() @IsBoolean(booleano) asignacionAutomatica?: boolean;
    @IsOptional() @IsIn(CARGAS_MAXIMAS, opcion(CARGAS_MAXIMAS)) cargaMaximaAgronomo?: string;
    @IsOptional() @IsIn(UMBRALES_PLAGA, opcion(UMBRALES_PLAGA)) umbralPlagaNueva?: string;
    @IsOptional() @IsIn(EXPIRACIONES, opcion(EXPIRACIONES)) expiracionSesion?: string;
}
