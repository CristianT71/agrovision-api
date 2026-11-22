import type { RolUsuario } from "../../domain/entities/usuario.entity";

// Códigos de acceso fijos, uno por rol, para un entorno de DEMOSTRACIÓN sin proveedor de SMS (SMS_PROVIDER=fijo).
// Funcionan como una contraseña compartida: quien conozca el teléfono de una cuenta y el código de su rol entra.
// Por eso solo se activan a propósito y no deben usarse con datos reales de productores.
export interface CodigosFijos {
    para(rol: RolUsuario): string;
}

export const CODIGOS_FIJOS = "CODIGOS_FIJOS";

interface EntornoCodigos {
    admin?: string;
    agronomo?: string;
    productor?: string;
}

const SEIS_DIGITOS = /^\d{6}$/;

// Falla al arrancar (no en el primer login) si falta un código o no tiene 6 dígitos
export function leerCodigosFijos({ admin, agronomo, productor }: EntornoCodigos): CodigosFijos {
    const codigos: Record<RolUsuario, string> = {
        admin: (admin ?? "").trim(),
        agronomo: (agronomo ?? "").trim(),
        productor: (productor ?? "").trim(),
    };
    const variables: Record<RolUsuario, string> = {
        admin: "OTP_FIJO_ADMIN",
        agronomo: "OTP_FIJO_AGRONOMO",
        productor: "OTP_FIJO_PRODUCTOR",
    };

    for (const rol of Object.keys(codigos) as RolUsuario[]) {
        if (!SEIS_DIGITOS.test(codigos[rol])) {
            throw new Error(`SMS_PROVIDER=fijo necesita ${variables[rol]} con exactamente 6 dígitos.`);
        }
    }

    return { para: (rol) => codigos[rol] };
}
