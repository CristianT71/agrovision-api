import { ReglaNegocioError } from "../errors/regla-negocio.error";

export const MAX_DIAS_VENTANA = 90;

const MS_POR_DIA = 86_400_000;

export interface VentanaTiempo {
    desde: Date;
    hasta: Date;
}

// RF-06.1: métricas en ventanas de tiempo dinámicas, con un tope para no barrer toda la tabla.
// Sin hasta, termina ahora; sin desde, empieza diasPorDefecto antes del fin. La ventana es [desde, hasta).
export function resolverVentana(
    desde: Date | undefined,
    hasta: Date | undefined,
    ahora: Date,
    diasPorDefecto: number,
): VentanaTiempo {
    const fin = hasta ?? ahora;
    const inicio = desde ?? new Date(fin.getTime() - diasPorDefecto * MS_POR_DIA);

    if (inicio.getTime() >= fin.getTime()) {
        throw new ReglaNegocioError("La fecha desde debe ser anterior a hasta.");
    }
    if (fin.getTime() - inicio.getTime() > MAX_DIAS_VENTANA * MS_POR_DIA) {
        throw new ReglaNegocioError(`La ventana no puede superar ${MAX_DIAS_VENTANA} días.`);
    }
    return { desde: inicio, hasta: fin };
}
