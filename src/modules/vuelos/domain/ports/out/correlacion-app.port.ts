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
}
