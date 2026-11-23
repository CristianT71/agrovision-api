import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import type {
    ArchivoVuelo,
    ConsultaArchivos,
    ConsultaVuelos,
    PuntoTraza,
    ResumenVuelo,
    Vuelo,
} from "../../../../domain/entities/vuelo";
import type { IVuelosRepository } from "../../../../domain/ports/out/vuelos.repository";
import { VueloNoEncontradoError } from "../../../../domain/errors/vuelos.error";
import { TypeOrmAuditoriaVuelosAdapter } from "./typeorm-auditoria-vuelos.adapter";

type Fila = Record<string, any>;
function vuelo(r: Fila): Vuelo {
    return {
        id: r.id,
        nombre: r.nombre,
        lote: r.lote,
        notas: r.notas,
        creadoEn: new Date(r.creado_en),
        creadoPor: r.creado_por,
    };
}
function archivo(r: Fila): ArchivoVuelo {
    return {
        id: r.id,
        vueloId: r.vuelo_id,
        nombreOriginal: r.nombre_original,
        tipo: r.tipo,
        banda: r.banda,
        mime: r.mime,
        tamanoBytes: Number(r.tamano_bytes),
        sha256: r.sha256,
        rutaAlmacenamiento: r.ruta_almacenamiento,
        capturadoEn: r.capturado_en ? new Date(r.capturado_en) : null,
        latitud: r.latitud,
        longitud: r.longitud,
        altitudAbsolutaM: r.altitud_absoluta_m,
        alturaRelativaM: r.altura_relativa_m,
        tipoAltitud: r.tipo_altitud,
        rtkFlag: r.rtk_flag,
        metadatos: r.metadatos,
        creadoEn: new Date(r.creado_en),
    };
}

export const COLUMNAS_ARCHIVO = `id,vuelo_id,nombre_original,tipo,banda,mime,tamano_bytes,sha256,ruta_almacenamiento,capturado_en,latitud,longitud,altitud_absoluta_m,altura_relativa_m,tipo_altitud,rtk_flag,metadatos,creado_en`;
// En listados no se transfieren ni los crudos ni la traza SRT desde PostgreSQL.
const COLUMNAS_LISTA = COLUMNAS_ARCHIVO.replace("metadatos,", "(metadatos - 'crudos' - 'traza') AS metadatos,");

// Un grupo por vuelo; ni el resumen ni la traza materializan todos sus archivos en Node.
export const SQL_RESUMEN = `SELECT vuelo_id,
    jsonb_build_object(
        'totalArchivos', count(*),
        'porTipo', jsonb_build_object('foto_rgb', count(*) FILTER (WHERE tipo='foto_rgb'), 'banda_multiespectral', count(*) FILTER (WHERE tipo='banda_multiespectral'), 'video', count(*) FILTER (WHERE tipo='video'), 'srt', count(*) FILTER (WHERE tipo='srt'), 'otro', count(*) FILTER (WHERE tipo='otro')),
        'tamanoTotalBytes', sum(tamano_bytes), 'primeraCapturaEn', min(capturado_en), 'ultimaCapturaEn', max(capturado_en),
        'duracionSegundos', extract(epoch FROM max(capturado_en)-min(capturado_en)),
        'altitudAbsolutaM', CASE WHEN count(altitud_absoluta_m)>0 THEN jsonb_build_object('min',min(altitud_absoluta_m),'max',max(altitud_absoluta_m),'media',avg(altitud_absoluta_m)) END,
        'alturaRelativaM', CASE WHEN count(altura_relativa_m)>0 THEN jsonb_build_object('min',min(altura_relativa_m),'max',max(altura_relativa_m),'media',avg(altura_relativa_m)) END,
        'caja', CASE WHEN count(*) FILTER (WHERE latitud IS NOT NULL AND longitud IS NOT NULL)>0 THEN jsonb_build_object('sur',min(latitud) FILTER (WHERE longitud IS NOT NULL),'norte',max(latitud) FILTER (WHERE longitud IS NOT NULL),'oeste',min(longitud) FILTER (WHERE latitud IS NOT NULL),'este',max(longitud) FILTER (WHERE latitud IS NOT NULL)) END,
        'centro', CASE WHEN count(*) FILTER (WHERE latitud IS NOT NULL AND longitud IS NOT NULL)>0 THEN jsonb_build_object('latitud',avg(latitud) FILTER (WHERE longitud IS NOT NULL),'longitud',avg(longitud) FILTER (WHERE latitud IS NOT NULL)) END,
        'rtk', CASE WHEN count(rtk_flag)>0 THEN jsonb_build_object('fijo',count(*) FILTER (WHERE rtk_flag=50),'otro',count(*) FILTER (WHERE rtk_flag<>50),'sinDato',count(*) FILTER (WHERE rtk_flag IS NULL)) END,
        'dron', CASE WHEN max(metadatos->'camara'->>'modelo') IS NOT NULL OR max(metadatos->'dron'->>'serie') IS NOT NULL THEN jsonb_build_object('modelo',max(metadatos->'camara'->>'modelo'),'serie',max(metadatos->'dron'->>'serie')) END
    ) AS resumen FROM vuelo_archivos WHERE vuelo_id = ANY($1::uuid[]) GROUP BY vuelo_id`;

export function resumenVacio(): ResumenVuelo {
    return {
        totalArchivos: 0,
        porTipo: null,
        tamanoTotalBytes: null,
        primeraCapturaEn: null,
        ultimaCapturaEn: null,
        duracionSegundos: null,
        altitudAbsolutaM: null,
        alturaRelativaM: null,
        caja: null,
        centro: null,
        rtk: null,
        dron: null,
    };
}

@Injectable()
export class TypeOrmVuelosRepository implements IVuelosRepository {
    constructor(
        private readonly db: DataSource,
        private readonly auditoria: TypeOrmAuditoriaVuelosAdapter,
    ) {}
    async crearAuditado(v: Vuelo) {
        await this.db.transaction(async (tx) => {
            await tx.query(
                `INSERT INTO vuelos (id,nombre,lote,notas,creado_en,creado_por) VALUES ($1,$2,$3,$4,$5,$6)`,
                [v.id, v.nombre, v.lote, v.notas, v.creadoEn, v.creadoPor],
            );
            await this.auditoria.registrarConGestor(tx, {
                accion: "vuelo_creado",
                actorUsuarioId: v.creadoPor,
                vueloId: v.id,
            });
        });
    }
    async obtener(id: string) {
        const filas: Fila[] = await this.db.query(`SELECT * FROM vuelos WHERE id=$1`, [id]);
        return filas[0] ? vuelo(filas[0]) : null;
    }
    async listar(c: ConsultaVuelos) {
        const pagina = c.pagina ?? 1,
            limite = c.limite ?? 20;
        const params: unknown[] = [],
            condiciones: string[] = [];
        if (c.lote !== undefined) {
            params.push(c.lote);
            condiciones.push(`lote=$${params.length}`);
        }
        if (c.desde) {
            params.push(c.desde);
            condiciones.push(`creado_en >= $${params.length}::timestamptz`);
        }
        if (c.hasta) {
            params.push(c.hasta);
            condiciones.push(`creado_en <= $${params.length}::timestamptz`);
        }
        const where = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";
        const [cuenta]: Fila[] = await this.db.query(`SELECT count(*) AS total FROM vuelos ${where}`, params);
        const filas: Fila[] = await this.db.query(
            `SELECT * FROM vuelos ${where} ORDER BY creado_en DESC,id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
            [...params, limite, (pagina - 1) * limite],
        );
        return { datos: filas.map(vuelo), total: Number(cuenta.total), pagina, limite };
    }
    async actualizar(id: string, cambios: Partial<Pick<Vuelo, "nombre" | "lote" | "notas">>) {
        const entradas = Object.entries(cambios).filter(
            ([k, v]) => ["nombre", "lote", "notas"].includes(k) && v !== undefined,
        );
        if (!entradas.length) return;
        const filas: Fila[] = await this.db.query(
            `WITH actualizados AS (UPDATE vuelos SET ${entradas.map(([k], i) => `${k}=$${i + 2}`).join(",")} WHERE id=$1 RETURNING id) SELECT id FROM actualizados`,
            [id, ...entradas.map(([, v]) => v)],
        );
        if (!filas.length) throw new VueloNoEncontradoError();
    }
    async eliminarAuditado(id: string, actor: string) {
        return this.db.transaction(async (tx) => {
            const existentes: Fila[] = await tx.query(`SELECT id FROM vuelos WHERE id=$1 FOR UPDATE`, [id]);
            if (!existentes.length) return false;
            await this.auditoria.registrarConGestor(tx, {
                accion: "vuelo_borrado",
                actorUsuarioId: actor,
                vueloId: id,
            });
            await tx.query(`DELETE FROM vuelos WHERE id=$1`, [id]);
            return true;
        });
    }
    async guardarArchivo(a: ArchivoVuelo) {
        return this.db.transaction(async (tx) => {
            const existentes: Fila[] = await tx.query(`SELECT id FROM vuelos WHERE id=$1 FOR UPDATE`, [a.vueloId]);
            if (!existentes.length) throw new VueloNoEncontradoError();
            const filas: Fila[] = await tx.query(
                `INSERT INTO vuelo_archivos (${COLUMNAS_ARCHIVO}) VALUES (${Array.from({ length: 18 }, (_, i) => `$${i + 1}`).join(",")}) ON CONFLICT (vuelo_id,sha256) DO NOTHING RETURNING ${COLUMNAS_ARCHIVO}`,
                [
                    a.id,
                    a.vueloId,
                    a.nombreOriginal,
                    a.tipo,
                    a.banda,
                    a.mime,
                    a.tamanoBytes,
                    a.sha256,
                    a.rutaAlmacenamiento,
                    a.capturadoEn,
                    a.latitud,
                    a.longitud,
                    a.altitudAbsolutaM,
                    a.alturaRelativaM,
                    a.tipoAltitud,
                    a.rtkFlag,
                    a.metadatos,
                    a.creadoEn,
                ],
            );
            if (filas[0]) return { archivo: archivo(filas[0]), duplicado: false };
            const [existente]: Fila[] = await tx.query(
                `SELECT ${COLUMNAS_ARCHIVO} FROM vuelo_archivos WHERE vuelo_id=$1 AND sha256=$2`,
                [a.vueloId, a.sha256],
            );
            return { archivo: archivo(existente), duplicado: true };
        });
    }
    async archivo(id: string, vueloId?: string) {
        const filas: Fila[] = await this.db.query(
            `SELECT ${COLUMNAS_ARCHIVO} FROM vuelo_archivos WHERE id=$1${vueloId ? " AND vuelo_id=$2" : ""}`,
            vueloId ? [id, vueloId] : [id],
        );
        return filas[0] ? archivo(filas[0]) : null;
    }
    async listarArchivos(id: string, c: ConsultaArchivos) {
        const pagina = c.pagina ?? 1,
            limite = c.limite ?? 50,
            params: unknown[] = [id],
            condiciones = ["vuelo_id=$1"];
        if (c.tipo) {
            params.push(c.tipo);
            condiciones.push(`tipo=$${params.length}`);
        }
        if (c.banda) {
            params.push(c.banda);
            condiciones.push(`banda=$${params.length}`);
        }
        const where = condiciones.join(" AND ");
        const [cuenta]: Fila[] = await this.db.query(
            `SELECT count(*) AS total FROM vuelo_archivos WHERE ${where}`,
            params,
        );
        const filas: Fila[] = await this.db.query(
            `SELECT ${COLUMNAS_LISTA} FROM vuelo_archivos WHERE ${where} ORDER BY capturado_en ASC NULLS LAST,creado_en ASC,id ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
            [...params, limite, (pagina - 1) * limite],
        );
        return { datos: filas.map(archivo), total: Number(cuenta.total), pagina, limite };
    }
    async resumen(ids: string[]) {
        if (!ids.length) return {};
        const filas: { vuelo_id: string; resumen: ResumenVuelo }[] = await this.db.query(SQL_RESUMEN, [ids]);
        return Object.fromEntries(
            ids.map((id) => [id, filas.find((f) => f.vuelo_id === id)?.resumen ?? resumenVacio()]),
        );
    }
    async puntos(id: string): Promise<PuntoTraza[]> {
        const filas: Fila[] = await this.db.query(
            `SELECT id,tipo,banda,capturado_en,latitud,longitud,altitud_absoluta_m FROM vuelo_archivos WHERE vuelo_id=$1 AND latitud IS NOT NULL AND longitud IS NOT NULL ORDER BY capturado_en ASC NULLS LAST,creado_en ASC,id ASC LIMIT 2001`,
            [id],
        );
        return filas.map((r) => ({
            id: r.id,
            tipo: r.tipo,
            banda: r.banda,
            capturadoEn: r.capturado_en ? new Date(r.capturado_en) : null,
            latitud: r.latitud,
            longitud: r.longitud,
            altitudAbsolutaM: r.altitud_absoluta_m,
        }));
    }
}
