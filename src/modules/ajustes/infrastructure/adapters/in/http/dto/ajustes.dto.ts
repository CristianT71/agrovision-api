import { IsBoolean, IsIn, ValidateIf } from "class-validator";
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
// Como @IsOptional pero solo para undefined: ningún ajuste admite null (null en cargaMaximaAgronomo,
// por ejemplo, se leería después como carga ilimitada)
const siLlega = () => ValidateIf((_obj, valor) => valor !== undefined);

// PATCH: todos los campos son opcionales, solo se cambia lo que llega
export class ActualizarAjustesPersonalesDto implements Partial<AjustesPersonales> {
    @siLlega() @IsIn(IDIOMAS, opcion(IDIOMAS)) idioma?: string;
    @siLlega() @IsIn(ZONAS_HORARIAS, opcion(ZONAS_HORARIAS)) zonaHoraria?: string;
    @siLlega() @IsBoolean(booleano) pushNavegador?: boolean;
    @siLlega() @IsBoolean(booleano) casosSinAsignar?: boolean;
    @siLlega() @IsBoolean(booleano) alertaPlagaNueva?: boolean;
    @siLlega() @IsBoolean(booleano) despliegues?: boolean;
    @siLlega() @IsBoolean(booleano) fallosOTA?: boolean;
    @siLlega() @IsBoolean(booleano) nuevasSolicitudes?: boolean;
}

export class ActualizarAjustesSistemaDto implements Partial<AjustesSistema> {
    @siLlega() @IsBoolean(booleano) asignacionAutomatica?: boolean;
    @siLlega() @IsIn(CARGAS_MAXIMAS, opcion(CARGAS_MAXIMAS)) cargaMaximaAgronomo?: string;
    @siLlega() @IsIn(UMBRALES_PLAGA, opcion(UMBRALES_PLAGA)) umbralPlagaNueva?: string;
    @siLlega() @IsIn(EXPIRACIONES, opcion(EXPIRACIONES)) expiracionSesion?: string;
}
