export const LECTURA_CORRELACION_APP = "LECTURA_CORRELACION_APP";
export interface CajaGeografica {
    sur: number;
    norte: number;
    oeste: number;
    este: number;
}
export interface RegistroCorrelacion {
    origen: "deteccion" | "solicitud";
    clase: string | null;
    confianza: number | null;
    fecha: string | null;
    latitud: number;
    longitud: number;
    // Revisión del agrónomo de la solicitud ligada (la propia, o la de la captura por captura_id); null si no hay.
    revision?: RevisionAgronomo | null;
}
export interface RevisionAgronomo {
    estadoSolicitud: string;
    tipoResultado: string | null;
    plagaIdentificada: string | null;
    fechaResolucion: string | null;
    agronomo: string | null;
}
export interface ReglaZonaCorrelacion {
    tipo: string;
    version: number;
    estado: string;
    calibrada: boolean;
    fuente: string | null;
    cortesIncidenciaPct: number[];
}
export interface LecturaCorrelacion {
    registros: RegistroCorrelacion[];
    resumen: {
        total: number;
        porOrigen: { deteccion: number; solicitud: number };
        porClase: { clase: string | null; total: number }[];
        fechaMin: string | null;
        fechaMax: string | null;
    };
}
export interface ILecturaCorrelacionApp {
    consultar(caja: CajaGeografica): Promise<LecturaCorrelacion>;
    reglasZona(): Promise<ReglaZonaCorrelacion[]>;
}
