import type { Categoria } from "./categoria-biologica";

// RF-07.3: contraste entre lo que predijo la máquina y lo que corrigió un humano
export const ESTADOS_REVISION = ["divergente", "coincide", "sin_revision"] as const;
export type EstadoRevision = (typeof ESTADOS_REVISION)[number];
export type OrigenRevision = "agronomo" | "productor";

export interface RevisionHumana {
    // Lo que dijo el productor en la app
    correccionProductor: string | null;
    confirmadaProductor: boolean;
    // Tipo de resultado de la solicitud resuelta que se abrió desde esta captura (RF-04.5)
    resultadoAgronomo: string | null;
}

export interface Divergencia {
    estado: EstadoRevision;
    origen: OrigenRevision | null;
}

// El agrónomo pesa más que el productor: es la evaluación experta del caso.
// IMPORTANTE: el monitor filtra con una expresión SQL equivalente (EXPRESION_REVISION en
// typeorm-lectura-detecciones.adapter.ts). Si cambia esta regla, debe cambiar allí también.
export function evaluarDivergencia(
    prediccion: { categoria: Categoria; clasePredicha: string | null },
    revision: RevisionHumana,
): Divergencia {
    switch (revision.resultadoAgronomo) {
        case "Corrige diagnóstico IA":
        case "Plaga nueva":
            return { estado: "divergente", origen: "agronomo" };
        case "Planta sana":
            return { estado: prediccion.categoria === "sano" ? "coincide" : "divergente", origen: "agronomo" };
        case "Confirma diagnóstico IA":
            return { estado: "coincide", origen: "agronomo" };
        // "Imagen no diagnosticable" no confirma ni corrige: decide lo que haya dicho el productor
    }

    if (revision.correccionProductor !== null) {
        const corrigio = revision.correccionProductor !== prediccion.clasePredicha;
        return { estado: corrigio ? "divergente" : "coincide", origen: "productor" };
    }

    if (revision.confirmadaProductor) {
        return { estado: "coincide", origen: "productor" };
    }

    return { estado: "sin_revision", origen: null };
}
