// Categorías biológicas con las que el monitor agrupa o excluye inferencias (RF-07.2).
// NOTA: el documento de base de datos lista plaga/deficiencia/sano/no_reconocido; se agrega
// "enfermedad" porque el catálogo (RF-05.1) y las clases del modelo la distinguen de las plagas,
// y "otra" para una clase identificada que no se reconoce (un modelo nuevo con nombres nuevos).
export const CATEGORIAS = ["enfermedad", "plaga", "deficiencia", "sano", "no_reconocido", "otra"] as const;
export type Categoria = (typeof CATEGORIAS)[number];

// Compuertas del clasificador en el teléfono (GateOutcome en la app)
export const RESULTADOS_COMPUERTA = ["IDENTIFIED", "UNCERTAIN", "OOD", "QUALITY_REJECTED"] as const;
export type ResultadoCompuerta = (typeof RESULTADOS_COMPUERTA)[number];

// Clases del dataset JMuBEN que reporta la memoria técnica, sin el prefijo de categoría
const ALIAS: Record<string, Categoria> = {
    leaf_rust: "enfermedad",
    cerscospora: "enfermedad",
    cercospora: "enfermedad",
    phoma: "enfermedad",
    otras_enfermedades: "enfermedad",
    miner: "plaga",
    healthy: "sano",
};

// La app nombra las clases con la categoría como prefijo (ADR-016): Enfermedad_Roya, Plaga_Minador, Sana
export function categorizar(resultado: ResultadoCompuerta, clase: string | null): Categoria {
    // Solo una predicción que pasó las tres compuertas cuenta como diagnóstico
    if (resultado !== "IDENTIFIED" || !clase?.trim()) return "no_reconocido";

    const normalizada = clase
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, "_");

    if (normalizada.startsWith("enfermedad")) return "enfermedad";
    if (normalizada.startsWith("plaga")) return "plaga";
    if (normalizada.startsWith("deficiencia")) return "deficiencia";
    if (normalizada === "sana" || normalizada === "sano") return "sano";

    return ALIAS[normalizada] ?? "otra";
}
