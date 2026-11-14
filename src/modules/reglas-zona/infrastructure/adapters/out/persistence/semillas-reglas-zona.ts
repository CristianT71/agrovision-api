// Semillas de reglas de zona compartidas por las migraciones CrearReglasZona y SembrarReglasZonaPendientes.
// Viven FUERA de src/database/migrations: TypeORM toma cada función exportada de ese directorio como una clase
// de migración ("migrationClass is not a constructor").

// Una regla v1 en BORRADOR por cada tipo (4 enfermedades y 2 plagas) con valores de EJEMPLO.
// Un agrónomo debe definir la tabla real, editarla y aprobarla; ninguna nace calibrada ni activa.
export interface SemillaReglaZona {
    id: string;
    tipoEnfermedad: string;
    nombreComun: string;
}

export const SEMILLAS_REGLAS_ZONA: readonly SemillaReglaZona[] = [
    {
        id: "6f1c2a52-8d0e-4c1b-9a7e-3b5d0c9e7a01",
        tipoEnfermedad: "roya",
        nombreComun: "Roya del cafeto (Hemileia vastatrix)",
    },
    {
        id: "6f1c2a52-8d0e-4c1b-9a7e-3b5d0c9e7a02",
        tipoEnfermedad: "cercospora",
        nombreComun: "Mancha de hierro (Cercospora coffeicola)",
    },
    {
        id: "6f1c2a52-8d0e-4c1b-9a7e-3b5d0c9e7a03",
        tipoEnfermedad: "phoma",
        nombreComun: "Muerte descendente (Phoma spp.)",
    },
    {
        id: "6f1c2a52-8d0e-4c1b-9a7e-3b5d0c9e7a04",
        tipoEnfermedad: "antracnosis",
        nombreComun: "Antracnosis (Colletotrichum spp.)",
    },
    {
        id: "6f1c2a52-8d0e-4c1b-9a7e-3b5d0c9e7a05",
        tipoEnfermedad: "minador",
        nombreComun: "Minador de la hoja (Leucoptera coffeella)",
    },
    { id: "6f1c2a52-8d0e-4c1b-9a7e-3b5d0c9e7a06", tipoEnfermedad: "hormigas", nombreComun: "Hormigas" },
];

// Filas de EJEMPLO (sev_max %, inc_max %) → radio en metros; iguales para todos los tipos sembrados.
export const FILAS_SEMILLA_REGLAS_ZONA = [
    { orden: 1, sevMax: 10, incMax: 20, radioMinM: 0, radioMaxM: 3 },
    { orden: 2, sevMax: 30, incMax: 40, radioMinM: 3, radioMaxM: 8 },
    { orden: 3, sevMax: 60, incMax: 70, radioMinM: 8, radioMaxM: 15 },
    { orden: 4, sevMax: 100, incMax: 100, radioMinM: 15, radioMaxM: 30 },
] as const;

export const notasSemillaReglaZona = (nombreComun: string): string =>
    `VALORES DE EJEMPLO sin criterio agronómico; un agrónomo debe definirlos antes de aprobar. Afección: ${nombreComun}. ` +
    "Tabla de muestra creada por la migración inicial: no proviene de ningún estudio ni fórmula y la zona resultante " +
    "es una estimación sin calibrar.";

export type EjecutarConsulta = (sql: string, parametros?: unknown[]) => Promise<unknown>;

// Idempotente y sin tocar reglas existentes: un tipo que ya tenga cualquier regla (de cualquier versión) no se
// siembra. Regla y filas van en una sola sentencia: las filas solo se insertan si la regla se acaba de crear, así
// que una semilla ya editada, aprobada o activa nunca recibe filas de vuelta.
export async function sembrarReglasZona(consultar: EjecutarConsulta): Promise<void> {
    const valores = FILAS_SEMILLA_REGLAS_ZONA.map((_, i) => {
        const b = 4 + i * 5;
        return `($${b}::smallint,$${b + 1}::double precision,$${b + 2}::double precision,$${b + 3}::double precision,$${b + 4}::double precision)`;
    });
    const sql = `WITH nueva AS (
            INSERT INTO "reglas_zona" ("id","tipo_enfermedad","version","estado","calibrada","notas","creada_por","creada_en")
            SELECT $1::uuid,$2::varchar,1,'borrador',false,$3::text,NULL,now()
            WHERE NOT EXISTS (SELECT 1 FROM "reglas_zona" WHERE "tipo_enfermedad" = $2::varchar)
            ON CONFLICT DO NOTHING
            RETURNING "id"
        )
        INSERT INTO "reglas_zona_filas" ("regla_id","orden","sev_max","inc_max","radio_min_m","radio_max_m")
        SELECT nueva."id", f.* FROM nueva CROSS JOIN (VALUES ${valores.join(",")}) AS f`;
    for (const semilla of SEMILLAS_REGLAS_ZONA) {
        await consultar(sql, [
            semilla.id,
            semilla.tipoEnfermedad,
            notasSemillaReglaZona(semilla.nombreComun),
            ...FILAS_SEMILLA_REGLAS_ZONA.flatMap((f) => [f.orden, f.sevMax, f.incMax, f.radioMinM, f.radioMaxM]),
        ]);
    }
}
