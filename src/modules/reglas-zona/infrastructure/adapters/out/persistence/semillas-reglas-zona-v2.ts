// Propuestas v2 (BORRADOR) de reglas de zona con los cortes de incidencia respaldados por una fuente publicada.
// Viven FUERA de src/database/migrations por la misma razón que semillas-reglas-zona.ts.
//
// Qué respaldan las fuentes y qué no:
// - Solo se documentaron cortes de INCIDENCIA para roya y mancha de hierro. No se encontró ninguna fuente que
//   convierta severidad o incidencia en un radio en metros: los radios son los de la semilla v1 (criterio de
//   ejemplo) y SIGUEN sin respaldo. La severidad no tiene corte documentado, por eso sevMax = 100 en todas las filas.
// - Phoma, antracnosis, minador y hormigas NO tienen propuesta: no hay un corte numérico en % citable (el minador se
//   decide por larvas vivas en 100 hojas, no por % de incidencia, y no cabe en esta tabla). No se inventó ninguno.
// Un agrónomo debe revisar, calibrar y aprobar; ninguna propuesta nace calibrada ni activa.
export interface PropuestaReglaZona {
    id: string;
    tipoEnfermedad: string;
    notas: string;
    filas: readonly { orden: number; sevMax: number; incMax: number; radioMinM: number; radioMaxM: number }[];
}

export const MARCA_PROPUESTA_V2 = "PROPUESTA v2 con fuente";

const AVISO_RADIOS =
    "Los radios en metros NO tienen fuente: son los valores de ejemplo de la v1. La severidad no tiene corte documentado " +
    "(sevMax = 100 en todas las filas). Un agrónomo debe revisar, calibrar y aprobar antes de usarla; sigue siendo una estimación sin calibrar.";

export const PROPUESTAS_REGLAS_ZONA_V2: readonly PropuestaReglaZona[] = [
    {
        id: "6f1c2a52-8d0e-4c1b-9a7e-3b5d0c9e7b01",
        tipoEnfermedad: "roya",
        notas:
            `${MARCA_PROPUESTA_V2} (Cenicafé). Cortes de incidencia por lote: menos de 5 %, de 5 a 15 % y 15 % o más, ` +
            "como los agrupan los boletines fitosanitarios de Cenicafé (con 15 % o más un lote puede ameritar control). " +
            "Fuente: https://publicaciones.cenicafe.org/index.php/fitosanitario/article/download/5668/6558/5484 . " +
            AVISO_RADIOS,
        filas: [
            { orden: 1, sevMax: 100, incMax: 5, radioMinM: 0, radioMaxM: 3 },
            { orden: 2, sevMax: 100, incMax: 15, radioMinM: 3, radioMaxM: 8 },
            { orden: 3, sevMax: 100, incMax: 100, radioMinM: 8, radioMaxM: 15 },
        ],
    },
    {
        id: "6f1c2a52-8d0e-4c1b-9a7e-3b5d0c9e7b02",
        tipoEnfermedad: "cercospora",
        notas:
            `${MARCA_PROPUESTA_V2} (estudio regional). Corte de incidencia del 5 %, el umbral de daño económico usado en un ` +
            "estudio en Cauca; no es una recomendación oficial de manejo de Cenicafé. Fuente de contexto: " +
            "https://biblioteca.cenicafe.org/bitstream/10778/993/20/18.%20Mancha%20de%20hierro.pdf . " +
            AVISO_RADIOS,
        filas: [
            { orden: 1, sevMax: 100, incMax: 5, radioMinM: 0, radioMaxM: 3 },
            { orden: 2, sevMax: 100, incMax: 100, radioMinM: 3, radioMaxM: 8 },
        ],
    },
];

export type EjecutarConsultaV2 = (sql: string, parametros?: unknown[]) => Promise<unknown>;

// Idempotente: no hace nada si ya existe una propuesta de esa regla (mismo id). La versión es la siguiente a la
// mayor existente del tipo, así no choca con v1 ni con versiones que un agrónomo haya creado.
// Si el tipo no tiene ninguna regla, no hace nada: la v1 sembrada es el punto de partida.
export async function sembrarPropuestasV2(consultar: EjecutarConsultaV2): Promise<void> {
    for (const p of PROPUESTAS_REGLAS_ZONA_V2) {
        const valores = p.filas.map((_, i) => {
            const b = 4 + i * 5;
            return `($${b}::smallint,$${b + 1}::double precision,$${b + 2}::double precision,$${b + 3}::double precision,$${b + 4}::double precision)`;
        });
        const sql = `WITH nueva AS (
                INSERT INTO "reglas_zona" ("id","tipo_enfermedad","version","estado","calibrada","notas","creada_por","creada_en")
                SELECT $1::uuid,$2::varchar,MAX("version")+1,'borrador',false,$3::text,NULL,now()
                FROM "reglas_zona" WHERE "tipo_enfermedad" = $2::varchar
                HAVING COUNT(*) > 0 AND NOT EXISTS (SELECT 1 FROM "reglas_zona" WHERE "id" = $1::uuid)
                ON CONFLICT DO NOTHING
                RETURNING "id"
            )
            INSERT INTO "reglas_zona_filas" ("regla_id","orden","sev_max","inc_max","radio_min_m","radio_max_m")
            SELECT nueva."id", f.* FROM nueva CROSS JOIN (VALUES ${valores.join(",")}) AS f`;
        await consultar(sql, [
            p.id,
            p.tipoEnfermedad,
            p.notas,
            ...p.filas.flatMap((f) => [f.orden, f.sevMax, f.incMax, f.radioMinM, f.radioMaxM]),
        ]);
    }
}
