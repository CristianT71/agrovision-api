import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import type { AdopcionModelo, IConsultaAdopcion } from "../../../../domain/ports/out/consulta-adopcion.port";

// Lee detecciones_app con SQL directo y no a través de DeteccionesModule: ese módulo ya importa
// este para resolver versiones, y importarlo de vuelta crearía una dependencia circular.
@Injectable()
export class TypeOrmConsultaAdopcionAdapter implements IConsultaAdopcion {
    constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

    async adopcionPorModelo(desde: Date): Promise<Map<string, AdopcionModelo>> {
        // DISTINCT ON: la detección más reciente de cada productor dice qué versión usa hoy.
        // Así quien actualizó no cuenta en dos versiones y los porcentajes suman 100.
        const filas = await this.dataSource.query<{ modelo_id: string | null; productores: number; total: number }[]>(
            `WITH ultima AS (
                SELECT DISTINCT ON (productor_id) productor_id, modelo_id
                FROM detecciones_app
                WHERE fecha >= $1
                ORDER BY productor_id, fecha DESC
            )
            SELECT modelo_id, COUNT(*)::int AS productores, (SUM(COUNT(*)) OVER ())::int AS total
            FROM ultima
            GROUP BY modelo_id`,
            [desde],
        );

        const adopcion = new Map<string, AdopcionModelo>();
        for (const fila of filas) {
            if (!fila.modelo_id || fila.total === 0) continue;

            adopcion.set(fila.modelo_id, {
                porcentaje: Math.round((fila.productores / fila.total) * 1000) / 10,
                productores: fila.productores,
            });
        }

        return adopcion;
    }
}
