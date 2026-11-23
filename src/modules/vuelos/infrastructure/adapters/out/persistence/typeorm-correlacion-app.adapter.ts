import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import type {
    CajaGeografica,
    ILecturaCorrelacionApp,
    LecturaCorrelacion,
    ReglaZonaCorrelacion,
} from "../../../../domain/ports/out/correlacion-app.port";

// Mismos filtros geográficos de las lecturas de mapas: consentimiento vigente y ambas
// coordenadas. Además se excluyen las solicitudes con ubicación simulada: no son posiciones reales
// y no sirven para compararlas con un vuelo. detecciones_app no tiene esa marca.
// Los IDs se usan solo para desempatar; nunca se incluyen en el resultado.
const SQL = `WITH candidatos AS (
    SELECT d.id, 'deteccion' AS origen, d.clase_predicha AS clase, d.confianza,
           d.fecha, d.latitud, d.longitud, r.estado AS rev_estado, r.tipo_resultado AS rev_tipo,
           r.plaga_identificada AS rev_plaga, r.fecha_resolucion AS rev_fecha, r.agronomo AS rev_agronomo
    FROM detecciones_app d INNER JOIN productores p ON p.id = d.productor_id
    LEFT JOIN LATERAL (
        SELECT s2.estado, s2.tipo_resultado, s2.plaga_identificada, s2.fecha_resolucion, a2.nombre AS agronomo
        FROM solicitudes s2 LEFT JOIN agronomos a2 ON a2.id = s2.agronomo_id
        WHERE s2.captura_id = d.id_cliente
        ORDER BY s2.fecha_resolucion DESC NULLS LAST, s2.fecha DESC, s2.id LIMIT 1
    ) r ON TRUE
    WHERE p.consentimiento IS TRUE AND d.defectuosa IS NOT TRUE
      AND d.latitud IS NOT NULL AND d.longitud IS NOT NULL
    UNION ALL
    SELECT s.id, 'solicitud' AS origen, s.plaga_identificada AS clase, s.confianza_ia AS confianza,
           s.fecha, s.latitud, s.longitud, s.estado AS rev_estado, s.tipo_resultado AS rev_tipo,
           s.plaga_identificada AS rev_plaga, s.fecha_resolucion AS rev_fecha, a.nombre AS rev_agronomo
    FROM solicitudes s INNER JOIN productores p ON p.id = s.productor_id
    LEFT JOIN agronomos a ON a.id = s.agronomo_id
    WHERE p.consentimiento IS TRUE AND s.ubicacion_simulada IS NOT TRUE
      AND s.latitud IS NOT NULL AND s.longitud IS NOT NULL
), coincidencias AS (
    SELECT * FROM candidatos
    WHERE latitud BETWEEN $1 AND $2
      AND (longitud BETWEEN $3 AND $4 OR longitud + 360 BETWEEN $3 AND $4 OR longitud - 360 BETWEEN $3 AND $4)
), limitados AS (
    SELECT * FROM coincidencias ORDER BY fecha DESC NULLS LAST, origen, id LIMIT 500
)
SELECT
    COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'origen', origen, 'clase', clase, 'confianza', confianza, 'fecha', fecha,
        'latitud', latitud, 'longitud', longitud,
        'revision', CASE WHEN rev_estado IS NULL THEN NULL ELSE jsonb_build_object(
            'estadoSolicitud', rev_estado, 'tipoResultado', rev_tipo, 'plagaIdentificada', rev_plaga,
            'fechaResolucion', rev_fecha, 'agronomo', rev_agronomo) END) ORDER BY fecha DESC NULLS LAST, origen, id)
        FROM limitados), '[]'::jsonb) AS registros,
    jsonb_build_object(
        'total', count(*),
        'porOrigen', jsonb_build_object('deteccion', count(*) FILTER (WHERE origen = 'deteccion'),
                                      'solicitud', count(*) FILTER (WHERE origen = 'solicitud')),
        'porClase', COALESCE((SELECT jsonb_agg(jsonb_build_object('clase', clase, 'total', total) ORDER BY clase NULLS LAST)
                            FROM (SELECT clase, count(*) AS total FROM coincidencias GROUP BY clase) clases), '[]'::jsonb),
        'fechaMin', min(fecha), 'fechaMax', max(fecha)
    ) AS resumen
FROM coincidencias`;

// Regla de zona más reciente no archivada por tipo (borrador incluido: se marca su estado) y su fuente citada.
const SQL_REGLAS = `SELECT DISTINCT ON (r.tipo_enfermedad) r.tipo_enfermedad AS tipo, r.version, r.estado, r.calibrada, r.notas,
    COALESCE((SELECT jsonb_agg(f.inc_max ORDER BY f.orden) FROM reglas_zona_filas f WHERE f.regla_id = r.id), '[]'::jsonb) AS cortes
FROM reglas_zona r WHERE r.estado <> 'archivada'
ORDER BY r.tipo_enfermedad, r.version DESC`;

export function fuenteDeNotas(notas: string | null): string | null {
    const url = notas?.match(/https?:\/\/[^\s]+/)?.[0];
    return url ? url.replace(/[.,;)]+$/, "") : null;
}

@Injectable()
export class TypeOrmCorrelacionAppAdapter implements ILecturaCorrelacionApp {
    constructor(private readonly db: DataSource) {}
    async reglasZona(): Promise<ReglaZonaCorrelacion[]> {
        const filas = await this.db.query<
            {
                tipo: string;
                version: number;
                estado: string;
                calibrada: boolean;
                notas: string | null;
                cortes: number[];
            }[]
        >(SQL_REGLAS);
        return filas.map((f) => ({
            tipo: f.tipo,
            version: f.version,
            estado: f.estado,
            calibrada: f.calibrada,
            fuente: fuenteDeNotas(f.notas),
            cortesIncidenciaPct: f.cortes,
        }));
    }
    async consultar(caja: CajaGeografica): Promise<LecturaCorrelacion> {
        const [resultado] = await this.db.query<LecturaCorrelacion[]>(SQL, [
            caja.sur,
            caja.norte,
            caja.oeste,
            caja.este,
        ]);
        // Ambas tablas guardan timestamp sin zona. Interpretación local igual al driver pg
        // de las lecturas existentes; no se inventa una zona horaria en SQL.
        const iso = (fecha: string | null) => (fecha === null ? null : new Date(fecha).toISOString());
        return {
            registros: resultado.registros.map((r) => ({
                origen: r.origen,
                clase: r.clase,
                confianza: r.confianza,
                fecha: iso(r.fecha),
                latitud: r.latitud,
                longitud: r.longitud,
                revision: r.revision
                    ? {
                          estadoSolicitud: r.revision.estadoSolicitud,
                          tipoResultado: r.revision.tipoResultado,
                          plagaIdentificada: r.revision.plagaIdentificada,
                          fechaResolucion: iso(r.revision.fechaResolucion),
                          agronomo: r.revision.agronomo,
                      }
                    : null,
            })),
            resumen: {
                ...resultado.resumen,
                fechaMin: iso(resultado.resumen.fechaMin),
                fechaMax: iso(resultado.resumen.fechaMax),
            },
        };
    }
}
