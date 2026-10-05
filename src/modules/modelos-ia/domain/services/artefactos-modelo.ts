import type { FormatoModelo } from "../entities/modelo-ia.entity";

// Validación de los archivos que acompañan a un modelo. Replica las comprobaciones que hace la app
// al instalarlo (ArtifactSchema.kt): un artefacto que la app rechazaría se rechaza aquí, antes de
// publicarlo a toda la flota. Cada función devuelve el motivo del rechazo o null si es válido.

// Por el contenido, no por la extensión: el nombre del archivo lo elige el cliente
export function detectarFormatoModelo(contenido: Buffer): FormatoModelo | null {
    // FlatBuffer de TFLite: identificador "TFL3" en los bytes 4 a 8
    if (contenido.length >= 8 && contenido.subarray(4, 8).toString("latin1") === "TFL3") return "tflite";

    // PyTorch: torch.save actual escribe un ZIP; el formato antiguo es un pickle (protocolo 2 a 5)
    if (contenido.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) return "pt";
    if (contenido[0] === 0x80 && contenido[1] >= 2 && contenido[1] <= 5) return "pt";

    return null;
}

// La app lee estos archivos como texto UTF-8 y OkHttp descarta el BOM: si se guardara con BOM,
// los bytes firmados no coincidirían con los que la app vuelve a hashear
export function normalizarJson(contenido: Buffer): Buffer {
    const conBom = contenido.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]));
    return conBom ? contenido.subarray(3) : contenido;
}

export interface ResumenEtiquetas {
    numeroClases: number;
    dimensionEmbedding: number;
    clases: string[];
}

function leerJson(contenido: Buffer): unknown {
    try {
        return JSON.parse(contenido.toString("utf8"));
    } catch {
        return undefined;
    }
}

const esEnteroPositivo = (valor: unknown): valor is number => Number.isInteger(valor) && (valor as number) > 0;
const esNumero = (valor: unknown): valor is number => typeof valor === "number" && Number.isFinite(valor);

// labels.json: { version, class_count, embedding_dim, classes: [{ index, class_id, display_name, pest_id? }] }
export function validarEtiquetas(contenido: Buffer): { resumen: ResumenEtiquetas } | { error: string } {
    const json = leerJson(contenido) as Record<string, unknown> | undefined;
    if (!json || typeof json !== "object") return { error: "El archivo de etiquetas no es un JSON válido." };

    const { class_count: numeroClases, embedding_dim: dimension, classes } = json;
    if (!esEnteroPositivo(numeroClases)) return { error: "Las etiquetas deben indicar class_count." };
    if (!esEnteroPositivo(dimension)) return { error: "Las etiquetas deben indicar embedding_dim." };
    if (!Array.isArray(classes) || classes.length !== numeroClases) {
        return { error: "La lista classes de las etiquetas no coincide con class_count." };
    }

    const entradas = classes as Record<string, unknown>[];
    const indices = entradas.map((clase) => clase?.index).sort((a, b) => Number(a) - Number(b));
    // Los logits salen por posición: un hueco o un índice repetido cambia el diagnóstico sin avisar
    if (!indices.every((indice, posicion) => indice === posicion)) {
        return { error: "Los índices de las etiquetas deben ir de 0 a class_count - 1 sin huecos." };
    }

    const ids = entradas.map((clase) => clase?.class_id);
    if (!ids.every((id) => typeof id === "string" && id.trim()) || new Set(ids).size !== ids.length) {
        return { error: "Cada etiqueta necesita un class_id único." };
    }

    const ordenadas = [...entradas].sort((a, b) => Number(a.index) - Number(b.index));
    return {
        resumen: {
            numeroClases,
            dimensionEmbedding: dimension,
            clases: ordenadas.map((clase) => clase.class_id as string),
        },
    };
}

// calibration.json debe ser coherente con las etiquetas (CalibrationParams.isConsistentWith en la app)
export function validarCalibracion(contenido: Buffer, etiquetas: ResumenEtiquetas): string | null {
    const json = leerJson(contenido) as Record<string, unknown> | undefined;
    if (!json || typeof json !== "object") return "El archivo de calibración no es un JSON válido.";

    const escalares = [
        "temperature",
        "confidence_threshold",
        "margin_threshold",
        "ood_threshold",
        "energy_weight",
        "energy_mean",
        "energy_std_dev",
    ];
    const faltante = escalares.find((campo) => !esNumero(json[campo]));
    if (faltante) return `La calibración debe incluir ${faltante} como número.`;

    if ((json.temperature as number) <= 0) return "La temperatura de calibración debe ser mayor que 0.";

    const centroides = json.class_centroids;
    if (!Array.isArray(centroides) || centroides.length !== etiquetas.numeroClases) {
        return "La calibración debe traer un centroide por clase.";
    }

    const d = etiquetas.dimensionEmbedding;
    if (!centroides.every((c) => Array.isArray(c) && c.length === d && c.every(esNumero))) {
        return `Cada centroide debe tener ${d} valores (embedding_dim de las etiquetas).`;
    }

    const matriz = json.precision_matrix;
    if (!Array.isArray(matriz) || matriz.length !== d * d || !matriz.every(esNumero)) {
        return `La matriz de precisión debe tener ${d * d} valores (${d}×${d}).`;
    }

    return null;
}
