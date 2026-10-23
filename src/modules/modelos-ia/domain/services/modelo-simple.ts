// Un modelo "simple" es el que sale tal cual del entrenamiento: un clasificador con softmax, una sola
// salida y sin embedding. La app lo instala igual que a uno completo, pero necesita sus labels.json y
// calibration.json: aquí se generan a partir del labels.txt, para no pedirle al administrador archivos
// que el entrenamiento no produce. Sin embedding no hay centroides ni matriz de precisión: la app lo
// reconoce por esas listas vacías y se salta la detección de muestras desconocidas.

interface ClaseConocida {
    // Id de la ficha en el catálogo de la app; null si la clase no es una plaga (planta sana, otras)
    pestId: string | null;
    nombre: string;
}

// Nombres con que aparecen las clases en los entrenamientos, normalizados (minúsculas y sin símbolos)
const CLASES_CONOCIDAS: Record<string, ClaseConocida> = {
    cerscospora: { pestId: "Enfermedad_ManchadeHierro", nombre: "Mancha de hierro" },
    cercospora: { pestId: "Enfermedad_ManchadeHierro", nombre: "Mancha de hierro" },
    leafrust: { pestId: "Enfermedad_Roya", nombre: "Roya del café" },
    roya: { pestId: "Enfermedad_Roya", nombre: "Roya del café" },
    miner: { pestId: "Plaga_Minador", nombre: "Minador de la hoja" },
    minador: { pestId: "Plaga_Minador", nombre: "Minador de la hoja" },
    phoma: { pestId: "Enfermedad_Phoma", nombre: "Quema del cogollo" },
    healthy: { pestId: null, nombre: "Hoja sana" },
    sana: { pestId: null, nombre: "Hoja sana" },
    otrasenfermedades: { pestId: null, nombre: "Otras enfermedades" },
};

// Umbrales de la compuerta de confianza de la app (sin compuerta de desconocidos, que necesita embedding)
const CONFIANZA_MINIMA = 0.55;
const MARGEN_MINIMO = 0.1;

const normalizar = (texto: string) => texto.toLowerCase().replace(/[^a-z0-9]/g, "");

export function generarArtefactosSimples(clases: string[]): { etiquetas: Buffer; calibracion: Buffer } {
    const etiquetas = {
        version: "1.0.0",
        class_count: clases.length,
        embedding_dim: 0,
        classes: clases.map((clase, index) => {
            const conocida = CLASES_CONOCIDAS[normalizar(clase)];
            return {
                index,
                class_id: clase,
                display_name: conocida?.nombre ?? clase,
                pest_id: conocida?.pestId ?? null,
            };
        }),
    };

    const calibracion = {
        version: "1.0.0",
        temperature: 1,
        confidence_threshold: CONFIANZA_MINIMA,
        margin_threshold: MARGEN_MINIMO,
        ood_threshold: 1e9,
        energy_weight: 0,
        energy_mean: 0,
        energy_std_dev: 1,
        class_centroids: [],
        precision_matrix: [],
    };

    return {
        etiquetas: Buffer.from(JSON.stringify(etiquetas)),
        calibracion: Buffer.from(JSON.stringify(calibracion)),
    };
}
