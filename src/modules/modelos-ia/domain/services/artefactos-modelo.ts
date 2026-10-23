import type { FormatoModelo } from "../entities/modelo-ia.entity";

// Validación de los archivos que acompañan a un modelo. Replica las comprobaciones que hace la app
// al instalarlo (ArtifactSchema.kt): un artefacto que la app rechazaría se rechaza aquí, antes de
// publicarlo a toda la flota. Cada función devuelve el motivo del rechazo o null si es válido.

const ES_ZIP = (contenido: Buffer) => contenido.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
const ES_HDF5 = (contenido: Buffer) => contenido.subarray(0, 4).equals(Buffer.from([0x89, 0x48, 0x44, 0x46]));

// Por el contenido, no por la extensión: el nombre del archivo lo elige el cliente.
// Una excepción: un .keras (ZIP) no se distingue de un .pt por sus bytes, y ahí la extensión decide
// entre ambos; un .keras o .h5 cuyo contenido no corresponde se rechaza.
export function detectarFormatoModelo(contenido: Buffer, nombre = ""): FormatoModelo | null {
    // FlatBuffer de TFLite: identificador "TFL3" en los bytes 4 a 8
    if (contenido.length >= 8 && contenido.subarray(4, 8).toString("latin1") === "TFL3") return "tflite";

    // Keras: el .keras actual es un ZIP y el formato antiguo .h5 es HDF5
    const extension = nombre.toLowerCase().slice(nombre.lastIndexOf("."));
    if (ES_HDF5(contenido) && extension === ".h5") return "keras";
    if (ES_ZIP(contenido) && extension === ".keras") return "keras";
    if (extension === ".keras" || extension === ".h5") return null;

    // PyTorch: torch.save actual escribe un ZIP; el formato antiguo es un pickle (protocolo 2 a 5)
    if (ES_ZIP(contenido)) return "pt";
    if (contenido[0] === 0x80 && contenido[1] >= 2 && contenido[1] <= 5) return "pt";

    return null;
}

// La app lee estos archivos como texto UTF-8 y OkHttp descarta el BOM: si se guardara con BOM,
// los bytes firmados no coincidirían con los que la app vuelve a hashear
export function normalizarJson(contenido: Buffer): Buffer {
    const conBom = contenido.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]));
    return conBom ? contenido.subarray(3) : contenido;
}

export const MAX_CLASES_TXT = 500;
export const MAX_LONGITUD_CLASE_TXT = 100;

// labels.txt del entrenamiento: una clase por línea, en el orden de las salidas del modelo
export function leerEtiquetasTexto(contenido: Buffer): { clases: string[] } | { error: string } {
    const clases = normalizarJson(contenido)
        .toString("utf8")
        .split(/\r?\n/)
        .map((linea) => linea.trim())
        .filter(Boolean);

    if (clases.length === 0) return { error: "El archivo de etiquetas está vacío." };
    if (clases.length > MAX_CLASES_TXT) return { error: `Las etiquetas no pueden pasar de ${MAX_CLASES_TXT} clases.` };
    if (
        clases.some(
            (clase) => clase.length > MAX_LONGITUD_CLASE_TXT || [...clase].some((letra) => letra.charCodeAt(0) < 32),
        )
    ) {
        return { error: `Cada clase debe ser texto de hasta ${MAX_LONGITUD_CLASE_TXT} caracteres.` };
    }
    if (new Set(clases).size !== clases.length) return { error: "Hay clases repetidas en las etiquetas." };

    return { clases };
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
