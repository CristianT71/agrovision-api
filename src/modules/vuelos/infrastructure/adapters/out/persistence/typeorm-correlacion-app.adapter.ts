import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import type {
    CajaGeografica,
    ILecturaCorrelacionApp,
    LecturaCorrelacion,
} from "../../../../domain/ports/out/correlacion-app.port";

// Mismos filtros geográficos de las lecturas de mapas: consentimiento vigente y ambas
// coordenadas. Además se excluyen las solicitudes con ubicación simulada: no son posiciones reales
// y no sirven para compararlas con un vuelo. detecciones_app no tiene esa marca.
// Los IDs se usan solo para desempatar; nunca se incluyen en el resultado.
const SQL = `WITH candidatos AS (
    SELECT d.id, 'deteccion' AS origen, d.clase_predicha AS clase, d.confianza,
           d.fecha, d.latitud, d.longitud
    FROM detecciones_app d INNER JOIN productores p ON p.id = d.productor_id
    WHERE p.consentimiento IS TRUE AND d.defectuosa IS NOT TRUE
      AND d.latitud IS NOT NULL AND d.longitud IS NOT NULL
    UNION ALL
    SELECT s.id, 'solicitud' AS origen, s.plaga_identificada AS clase, s.confianza_ia AS confianza,
           s.fecha, s.latitud, s.longitud
    FROM solicitudes s INNER JOIN productores p ON p.id = s.productor_id
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
        'latitud', latitud, 'longitud', longitud) ORDER BY fecha DESC NULLS LAST, origen, id)
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

@Injectable()
export class TypeOrmCorrelacionAppAdapter implements ILecturaCorrelacionApp {
    constructor(private readonly db: DataSource) {}
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
            })),
            resumen: {
                ...resultado.resumen,
                fechaMin: iso(resultado.resumen.fechaMin),
                fechaMax: iso(resultado.resumen.fechaMax),
            },
        };
    }
}
