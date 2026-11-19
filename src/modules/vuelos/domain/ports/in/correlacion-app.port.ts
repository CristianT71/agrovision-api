import type { CajaGeografica, LecturaCorrelacion, RegistroCorrelacion } from "../out/correlacion-app.port";

export const CORRELACION_APP = "CORRELACION_APP";
export interface CorrelacionAppVista {
    caja: CajaGeografica | null;
    cajaAmpliada: CajaGeografica | null;
    radioM: number;
    fechaVuelo: string | null;
    registros: (RegistroCorrelacion & { diasDesdeVuelo: number | null })[];
    truncado: boolean;
    limitaciones: string[];
    resumen: LecturaCorrelacion["resumen"];
}
export interface ICorrelacionApp {
    ejecutar(id: string, radioM?: number): Promise<CorrelacionAppVista>;
}
