// Opciones cerradas de cada ajuste: son las mismas que ofrece el panel y las únicas que acepta la API.
export const IDIOMAS = ["Español (Colombia)", "Español (México)", "English (US)"] as const;
export const ZONAS_HORARIAS = ["Bogotá (UTC−5)", "Ciudad de México (UTC−6)", "Lima (UTC−5)", "Quito (UTC−5)"] as const;
export const UMBRALES_PLAGA = ["3 casos/semana", "5 casos/semana", "8 casos/semana", "10 casos/semana"] as const;
export const CARGAS_MAXIMAS = ["5 casos", "10 casos", "15 casos", "Sin límite"] as const;
export const EXPIRACIONES = ["15 minutos", "30 minutos", "1 hora", "4 horas"] as const;

// "10 casos" -> 10; "Sin límite" -> null
export function cargaMaximaComoNumero(valor: string): number | null {
    const numero = parseInt(valor, 10);
    return Number.isNaN(numero) ? null : numero;
}

// "8 casos/semana" -> 8
export function umbralPlagaComoNumero(valor: string): number {
    const numero = parseInt(valor, 10);
    return Number.isNaN(numero) ? parseInt(AJUSTES_SISTEMA_POR_DEFECTO.umbralPlagaNueva, 10) : numero;
}

// "15 minutos" -> 15; "1 hora" -> 60; "4 horas" -> 240
export function minutosDeExpiracion(valor: string): number {
    const numero = parseInt(valor, 10);
    if (Number.isNaN(numero)) return parseInt(AJUSTES_SISTEMA_POR_DEFECTO.expiracionSesion, 10);
    return /hora/i.test(valor) ? numero * 60 : numero;
}

// ---------- Personales: cada cuenta tiene los suyos ----------

export interface AjustesPersonales {
    idioma: string;
    zonaHoraria: string;
    pushNavegador: boolean;
    // Eventos del administrador
    casosSinAsignar: boolean;
    alertaPlagaNueva: boolean;
    despliegues: boolean;
    fallosOTA: boolean;
    // Eventos del agrónomo
    nuevasSolicitudes: boolean;
}

export const AJUSTES_PERSONALES_POR_DEFECTO: AjustesPersonales = {
    idioma: "Español (Colombia)",
    zonaHoraria: "Bogotá (UTC−5)",
    pushNavegador: true,
    casosSinAsignar: true,
    alertaPlagaNueva: true,
    despliegues: true,
    fallosOTA: true,
    nuevasSolicitudes: true,
};

const COMUNES: (keyof AjustesPersonales)[] = ["idioma", "zonaHoraria", "pushNavegador"];

// Qué ajustes personales existen para cada rol: un agrónomo no tiene los eventos del administrador
export const CLAVES_PERSONALES_POR_ROL: Record<string, (keyof AjustesPersonales)[]> = {
    admin: [...COMUNES, "casosSinAsignar", "alertaPlagaNueva", "despliegues", "fallosOTA"],
    agronomo: [...COMUNES, "nuevasSolicitudes"],
};

// ---------- Del sistema: uno solo para toda la plataforma, lo cambia el administrador ----------

export interface AjustesSistema {
    asignacionAutomatica: boolean;
    cargaMaximaAgronomo: string;
    umbralPlagaNueva: string;
    expiracionSesion: string;
}

export const AJUSTES_SISTEMA_POR_DEFECTO: AjustesSistema = {
    asignacionAutomatica: false,
    cargaMaximaAgronomo: "10 casos", // RF-08.4
    umbralPlagaNueva: "5 casos/semana", // RF-06.7
    expiracionSesion: "30 minutos", // RNF-02.2
};
