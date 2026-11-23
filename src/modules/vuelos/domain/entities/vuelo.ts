export const TIPOS_ARCHIVO = ["foto_rgb", "banda_multiespectral", "video", "srt", "otro"] as const;
export const BANDAS = ["green", "red", "rededge", "nir"] as const;
export type TipoArchivo = (typeof TIPOS_ARCHIVO)[number];
export type Banda = (typeof BANDAS)[number];
export type Json = null | string | number | boolean | Json[] | { [key: string]: Json };
export type Bloque = Record<string, Json> | null;

export interface DatosExtraidos {
    tipo: TipoArchivo;
    banda: Banda | null;
    capturadoEn: Date | null;
    latitud: number | null;
    longitud: number | null;
    altitudAbsolutaM: number | null;
    alturaRelativaM: number | null;
    tipoAltitud: "RtkAlt" | "GPSFusionAlt" | "PressureAlt" | null;
    rtkFlag: number | null;
    metadatos: {
        crudos: Record<string, Json>;
        gps: Bloque;
        camara: Bloque;
        orientacion: Bloque;
        multiespectral: Bloque;
        dron: Bloque;
        traza?: Json[];
        miniatura?: boolean;
    };
}

export interface Vuelo {
    id: string;
    nombre: string;
    lote: string | null;
    notas: string | null;
    creadoEn: Date;
    creadoPor: string;
}

export interface ArchivoVuelo extends DatosExtraidos {
    id: string;
    vueloId: string;
    nombreOriginal: string;
    mime: string;
    tamanoBytes: number;
    sha256: string;
    rutaAlmacenamiento: string;
    creadoEn: Date;
}

export interface ArchivoRecibido {
    id: string;
    nombreOriginal: string;
    extension: string;
    mime: string;
    tamanoBytes: number;
    sha256: string;
    rutaAlmacenamiento: string;
}

export interface ConsultaVuelos {
    pagina?: number;
    limite?: number;
    lote?: string;
    desde?: string;
    hasta?: string;
}
export interface ConsultaArchivos {
    pagina?: number;
    limite?: number;
    tipo?: TipoArchivo;
    banda?: Banda;
}
export interface Pagina<T> {
    datos: T[];
    total: number;
    pagina: number;
    limite: number;
}
export type ResumenVuelo = Record<string, Json>;
export type PuntoTraza = Pick<
    ArchivoVuelo,
    "id" | "tipo" | "banda" | "capturadoEn" | "latitud" | "longitud" | "altitudAbsolutaM"
>;
