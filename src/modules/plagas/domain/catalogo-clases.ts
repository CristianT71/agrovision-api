// Relación entre las fichas del catálogo y las clases del modelo de reconocimiento. La API pública
// la usa para que quien consuma el catálogo pueda ligar una predicción del modelo con su ficha.
//
// - `clave`: identificador estable y legible de la ficha (no cambia aunque cambie el nombre).
// - `clase`: nombre de la clase tal como la escribe el modelo en su `labels.txt`.
// - `desdeVersion`: primera versión del modelo que reconoce la clase. Las de la 3.0.0 se agregan al final
//   de la lista de clases, sin mover las anteriores (el índice de cada salida es su posición).
export interface ClaseCatalogo {
    clave: string;
    // null si la ficha existe en el catálogo pero el modelo todavía no la reconoce como clase
    clase: string | null;
    desdeVersion: string | null;
}

// Indexado por el id de la ficha (los UUID con que las siembran las migraciones del catálogo)
export const CLASES_CATALOGO: Readonly<Record<string, ClaseCatalogo>> = {
    "c3e5bbaa-8ede-5235-b50a-1d815216d938": {
        clave: "Enfermedad_ManchadeHierro",
        clase: "Cerscospora",
        desdeVersion: "2.0.0",
    },
    "c0b3b861-711a-4a1f-ac90-b52df14786c8": { clave: "Hoja_Sana", clase: "Healthy", desdeVersion: "2.0.0" },
    "dd8cfa55-a7a6-5e64-80b3-32c106f5ff19": { clave: "Enfermedad_Roya", clase: "Leaf rust", desdeVersion: "2.0.0" },
    "f07804ae-b272-514f-bec4-b96013f87c10": { clave: "Plaga_Minador", clase: "Miner", desdeVersion: "2.0.0" },
    "27f3d9ea-5211-5583-a683-b8891da1e561": { clave: "Enfermedad_Phoma", clase: "Phoma", desdeVersion: "2.0.0" },
    "7bf4dc8f-0d24-5f8a-b360-de25f56b3a78": {
        clave: "Deficiencia_Azufre",
        clase: "Deficiencia_Azufre",
        desdeVersion: "2.0.0",
    },
    "9c469f9c-409a-53df-a013-62be21218c1b": {
        clave: "Deficiencia_Potasio",
        clase: "Deficiencia_Potasio",
        desdeVersion: "2.0.0",
    },
    "d5741c2b-1604-5c68-ab7f-3f2a9309087d": {
        clave: "Enfermedad_Antracnosis",
        clase: "Enfermedad_Antracnosis",
        desdeVersion: "2.0.0",
    },
    "86d53402-e95a-52a7-ab5d-b8b469fb7eeb": { clave: "Enfermedad_OjodeGallo", clase: null, desdeVersion: null },
    "b7109286-aa5c-4c52-ab91-15329f568d28": {
        clave: "Deficiencia_Boro",
        clase: "Deficiencia_Boro",
        desdeVersion: "3.0.0",
    },
    "a2b3224d-01a5-4336-a058-5853cf07690b": {
        clave: "Deficiencia_Calcio",
        clase: "Deficiencia_Calcio",
        desdeVersion: "3.0.0",
    },
    "d3b2f62b-ef92-47de-b174-a6cb89f1b1ad": {
        clave: "Deficiencia_Hierro",
        clase: "Deficiencia_Hierro",
        desdeVersion: "3.0.0",
    },
    "b83275df-49a2-420e-add3-dcf4457b3d9a": {
        clave: "Deficiencia_Nitrogeno",
        clase: "Deficiencia_Nitrogeno",
        desdeVersion: "3.0.0",
    },
    "36f38aee-c062-4476-8028-955e4577af8f": {
        clave: "Deficiencia_Fosforo",
        clase: "Deficiencia_Fosforo",
        desdeVersion: "3.0.0",
    },
    "04d50835-802c-498d-8ad1-406cb1de3f01": {
        clave: "Deficiencia_Manganeso",
        clase: "Deficiencia_Manganeso",
        desdeVersion: "3.0.0",
    },
    "8e3a7c7b-1424-48ba-a802-bf45159051a7": {
        clave: "Deficiencia_Magnesio",
        clase: "Deficiencia_Magnesio",
        desdeVersion: "3.0.0",
    },
    "c07f02d2-74c9-4be8-861d-00554bf85cf6": {
        clave: "Deficiencia_Zinc",
        clase: "Deficiencia_Zinc",
        desdeVersion: "3.0.0",
    },
    "ab226512-2dcf-45e8-82b4-95edc9dc4a98": {
        clave: "Hormigas_hormigueros",
        clase: "Hormigas_hormigueros",
        desdeVersion: "3.0.0",
    },
};

// La ficha de hormigas se creó desde el panel y no la siembra ninguna migración: su UUID cambia entre bases.
// Por eso también se busca por clave, que se deriva del nombre y no cambia.
export const CLASES_CATALOGO_POR_CLAVE: Readonly<Record<string, ClaseCatalogo>> = Object.fromEntries(
    Object.values(CLASES_CATALOGO).map((clase) => [clase.clave, clase]),
);
