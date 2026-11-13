import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { FichaCatalogo, ICatalogoRepository } from "../../../../domain/ports/out/catalogo.repository";
import { TypeOrmPlagaEntity } from "./typeorm-plaga.entity";

type FilaCatalogo = Omit<FichaCatalogo, "aval"> & {
    nombreAgronomo: string | null;
    numeroTarjeta: string | null;
    fechaAval: Date | null;
};

@Injectable()
export class TypeOrmCatalogoRepository implements ICatalogoRepository {
    constructor(@InjectRepository(TypeOrmPlagaEntity) private readonly repository: Repository<TypeOrmPlagaEntity>) {}

    async leerDelta(since?: number) {
        return this.repository.manager.transaction("READ COMMITTED", async (manager) => {
            // Catálogo pequeño: esperar escritores previos y bloquear brevemente nuevas escrituras
            // permite tomar un cursor que no salte transacciones aún sin confirmar.
            await manager.query("LOCK TABLE plagas IN SHARE MODE");
            const [{ serverTime }] = await manager.query<{ serverTime: number }[]>(
                `SELECT floor(extract(epoch FROM clock_timestamp()) * 1000)::float8 AS "serverTime"`,
            );
            const filas = await manager.query<FilaCatalogo[]>(
                `SELECT p.catalog_id AS "catalogId", p.nombre_cientifico AS "nombreCientifico",
                    p.nombre_comun AS "nombreComun", p.cultivo, p.organos_afectados AS "organosAfectados",
                    p.descripcion, p.medidas_contencion AS "medidasContencion", p.protocolo_quimico AS "protocoloQuimico",
                    p.foto_url AS "fotoUrl", p.catalog_version AS version, p.tipo,
                    ARRAY(SELECT s.sinonimo FROM sinonimos_plaga s WHERE s.plaga_id = p.id ORDER BY s.sinonimo) AS sinonimos,
                    a.nombre_agronomo AS "nombreAgronomo", a.numero_tarjeta AS "numeroTarjeta", a.fecha_aval AS "fechaAval"
                FROM plagas p
                LEFT JOIN LATERAL (
                    SELECT nombre_agronomo, numero_tarjeta, fecha_aval FROM avales_plaga
                    WHERE plaga_id = p.id ORDER BY fecha_aval DESC, id ASC LIMIT 1
                ) a ON true
                WHERE ($1::timestamptz IS NULL OR p.updated_at >= $1::timestamptz)
                ORDER BY p.catalog_id`,
                [since === undefined ? null : new Date(since)],
            );
            const bajas =
                since === undefined
                    ? []
                    : await manager.query<{ catalogId: string }[]>(
                          `SELECT catalog_id AS "catalogId" FROM plagas_catalogo_bajas WHERE deleted_at >= $1 ORDER BY catalog_id`,
                          [new Date(since)],
                      );
            const fichas: FichaCatalogo[] = filas.map(({ nombreAgronomo, numeroTarjeta, fechaAval, ...ficha }) => ({
                ...ficha,
                ...(nombreAgronomo && numeroTarjeta && fechaAval
                    ? { aval: { nombreAgronomo, numeroTarjeta, fechaAval } }
                    : {}),
            }));
            return { fichas, deletedIds: bajas.map((baja) => baja.catalogId), serverTime };
        });
    }
}
