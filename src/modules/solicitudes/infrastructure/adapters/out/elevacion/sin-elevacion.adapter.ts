import type { IConsultarElevacion } from "../../../../domain/ports/out/consultar-elevacion.port";

// ELEVATION_PROVIDER=none (o sin clave): la altitud solo existe cuando la manda el GPS
export class SinElevacionAdapter implements IConsultarElevacion {
    consultar(): Promise<number | null> {
        return Promise.resolve(null);
    }
}
