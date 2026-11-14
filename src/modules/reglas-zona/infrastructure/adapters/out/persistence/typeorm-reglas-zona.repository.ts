import type { EntityManager } from "typeorm";
import { ReglaZona, type EstadoRegla, type FilaRegla } from "../../../../domain/entities/regla-zona";
import type {
    FiltrosReglasZona,
    IReglasZonaEscritura,
    IReglasZonaRepository,
} from "../../../../domain/ports/out/reglas-zona.repository";
import { ReglaNoAprobadaError, VersionEnConflictoError } from "../../../../domain/errors/reglas-zona.error";

export interface FilaBdRegla {
    id: string;
    tipo_enfermedad: string;
    version: number;
    revision: number;
    estado: EstadoRegla;
    calibrada: boolean;
    notas: string | null;
    creada_por: string | null;
    creada_en: Date;
    aprobada_por_usuario_id: string | null;
    aprobada_por_nombre: string | null;
    aprobada_por_tarjeta: string | null;
    aprobada_en: Date | null;
    activada_en: Date | null;
}
export interface FilaBdTabla {
    regla_id: string;
    orden: number;
    sev_max: number;
    inc_max: number;
    radio_min_m: number;
    radio_max_m: number;
}
// Cabecera con sus filas agregadas en la misma sentencia (una sola instantánea).
type FilaBdReglaConFilas = FilaBdRegla & { filas: Omit<FilaBdTabla, "regla_id">[] };
interface FilaId {
    id: string;
}

const COLUMNAS = `id,tipo_enfermedad,version,revision,estado,calibrada,notas,creada_por,creada_en,aprobada_por_usuario_id,aprobada_por_nombre,aprobada_por_tarjeta,aprobada_en,activada_en`;
const COLUMNAS_FILA = `regla_id,orden,sev_max,inc_max,radio_min_m,radio_max_m`;
const FILAS_AGREGADAS = `COALESCE((SELECT json_agg(json_build_object('orden',f.orden,'sev_max',f.sev_max,'inc_max',f.inc_max,
    'radio_min_m',f.radio_min_m,'radio_max_m',f.radio_max_m) ORDER BY f.orden)
    FROM reglas_zona_filas f WHERE f.regla_id = reglas_zona.id), '[]'::json) AS filas`;

export function aDominio(r: FilaBdRegla, filas: FilaBdTabla[]): ReglaZona {
    return ReglaZona.reconstruir({
        id: r.id,
        tipoEnfermedad: r.tipo_enfermedad,
        version: Number(r.version),
        revision: Number(r.revision),
        estado: r.estado,
        calibrada: r.calibrada,
        notas: r.notas,
        filas: filas
            .filter((f) => f.regla_id === r.id)
            .sort((a, b) => a.orden - b.orden)
            .map((f) => ({
                orden: Number(f.orden),
                sevMax: Number(f.sev_max),
                incMax: Number(f.inc_max),
                radioMinM: Number(f.radio_min_m),
                radioMaxM: Number(f.radio_max_m),
            })),
        creadaPor: r.creada_por,
        creadaEn: new Date(r.creada_en),
        aprobadaPor:
            r.aprobada_por_nombre !== null && r.aprobada_por_tarjeta !== null
                ? { nombre: r.aprobada_por_nombre, tarjetaProfesional: r.aprobada_por_tarjeta }
                : null,
        aprobadaPorUsuarioId: r.aprobada_por_usuario_id,
        aprobadaEn: r.aprobada_en ? new Date(r.aprobada_en) : null,
        activadaEn: r.activada_en ? new Date(r.activada_en) : null,
    });
}

function esViolacionUnica(error: unknown): boolean {
    return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

// `gestor` es el EntityManager global (lecturas) o el de una transacción (TypeOrmUnidadTrabajoReglasZona).
// Las escrituras no abren transacción propia: la unidad de trabajo las agrupa con su auditoría.
export class TypeOrmReglasZonaRepository implements IReglasZonaRepository, IReglasZonaEscritura {
    constructor(private readonly gestor: Pick<EntityManager, "query">) {}

    async obtener(id: string) {
        return (await this.leer(`WHERE id=$1`, [id]))[0] ?? null;
    }

    async obtenerParaModificar(id: string) {
        // Primero el bloqueo y después la lectura, en sentencias separadas: si el bloqueo tuvo que esperar a otra
        // transacción, la lectura posterior ya ve lo que esa transacción confirmó (cabecera y filas).
        const bloqueada = await this.gestor.query<FilaId[]>(`SELECT id FROM reglas_zona WHERE id=$1 FOR UPDATE`, [id]);
        if (bloqueada.length === 0) return null;
        return this.obtener(id);
    }

    async listar(filtros: FiltrosReglasZona) {
        const condiciones: string[] = [],
            params: string[] = [];
        if (filtros.tipo) {
            params.push(filtros.tipo);
            condiciones.push(`tipo_enfermedad=$${params.length}`);
        }
        if (filtros.estado) {
            params.push(filtros.estado);
            condiciones.push(`estado=$${params.length}`);
        }
        const where = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";
        return this.leer(where, params);
    }

    async obtenerActiva(tipoEnfermedad: string) {
        return (await this.leer(`WHERE tipo_enfermedad=$1 AND estado='activa'`, [tipoEnfermedad]))[0] ?? null;
    }

    async insertarNuevaVersion(tipoEnfermedad: string, construir: (version: number) => ReglaZona) {
        try {
            // Serializa la numeración por tipo: dos altas simultáneas no calculan la misma versión.
            await this.gestor.query(`SELECT pg_advisory_xact_lock(hashtext('reglas_zona:' || $1))`, [tipoEnfermedad]);
            const [{ siguiente }] = await this.gestor.query<{ siguiente: number }[]>(
                `SELECT COALESCE(MAX(version),0)+1 AS siguiente FROM reglas_zona WHERE tipo_enfermedad=$1`,
                [tipoEnfermedad],
            );
            const regla = construir(Number(siguiente));
            const d = regla.instantanea();
            await this.gestor.query(
                `INSERT INTO reglas_zona (id,tipo_enfermedad,version,revision,estado,calibrada,notas,creada_por,creada_en) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
                [
                    d.id,
                    d.tipoEnfermedad,
                    d.version,
                    d.revision,
                    d.estado,
                    d.calibrada,
                    d.notas,
                    d.creadaPor,
                    d.creadaEn,
                ],
            );
            await this.insertarFilas(d.id, d.filas);
            return regla;
        } catch (error) {
            if (esViolacionUnica(error)) throw new VersionEnConflictoError();
            throw error;
        }
    }

    async guardarBorrador(regla: ReglaZona, revisionVista: number, cambiaFilas: boolean) {
        const d = regla.instantanea();
        const filas = await this.gestor.query<FilaId[]>(
            `WITH r AS (UPDATE reglas_zona SET notas=$2, revision=$3
             WHERE id=$1 AND estado='borrador' AND revision=$4 RETURNING id) SELECT id FROM r`,
            [d.id, d.notas, d.revision, revisionVista],
        );
        if (filas.length === 0) return false;
        // Un cambio de solo notas no toca la tabla: no puede pisar filas guardadas por otra edición.
        if (cambiaFilas) {
            await this.gestor.query(`DELETE FROM reglas_zona_filas WHERE regla_id=$1`, [d.id]);
            await this.insertarFilas(d.id, d.filas);
        }
        return true;
    }

    async eliminarBorrador(id: string) {
        const filas = await this.gestor.query<FilaId[]>(
            `WITH r AS (DELETE FROM reglas_zona WHERE id=$1 AND estado='borrador' RETURNING id) SELECT id FROM r`,
            [id],
        );
        return filas.length > 0;
    }

    async guardarAprobacion(regla: ReglaZona, revisionVista: number) {
        const d = regla.instantanea();
        const filas = await this.gestor.query<FilaId[]>(
            `WITH r AS (UPDATE reglas_zona SET estado='aprobada', calibrada=$2, notas=$3, aprobada_por_usuario_id=$4,
                aprobada_por_nombre=$5, aprobada_por_tarjeta=$6, aprobada_en=$7, revision=$8
             WHERE id=$1 AND estado='borrador' AND revision=$9 RETURNING id) SELECT id FROM r`,
            [
                d.id,
                d.calibrada,
                d.notas,
                d.aprobadaPorUsuarioId,
                d.aprobadaPor?.nombre ?? null,
                d.aprobadaPor?.tarjetaProfesional ?? null,
                d.aprobadaEn,
                d.revision,
                revisionVista,
            ],
        );
        return filas.length > 0;
    }

    async activar(regla: ReglaZona) {
        const d = regla.instantanea();
        // Bloquea todas las reglas del tipo: la activa previa y la nueva cambian juntas o ninguna.
        const bloqueadas = await this.gestor.query<{ id: string; estado: EstadoRegla }[]>(
            `SELECT id,estado FROM reglas_zona WHERE tipo_enfermedad=$1 ORDER BY id FOR UPDATE`,
            [d.tipoEnfermedad],
        );
        if (bloqueadas.find((r) => r.id === d.id)?.estado !== "aprobada") throw new ReglaNoAprobadaError();
        const archivadas = await this.gestor.query<FilaId[]>(
            `WITH r AS (UPDATE reglas_zona SET estado='archivada', archivada_en=$2
             WHERE tipo_enfermedad=$1 AND estado='activa' RETURNING id) SELECT id FROM r`,
            [d.tipoEnfermedad, d.activadaEn],
        );
        await this.gestor.query(`UPDATE reglas_zona SET estado='activa', activada_en=$2 WHERE id=$1`, [
            d.id,
            d.activadaEn,
        ]);
        return { archivadaId: archivadas[0]?.id ?? null };
    }

    async archivar(regla: ReglaZona, estadoPrevio: EstadoRegla) {
        const filas = await this.gestor.query<FilaId[]>(
            `WITH r AS (UPDATE reglas_zona SET estado='archivada', archivada_en=now() WHERE id=$1 AND estado=$2 RETURNING id) SELECT id FROM r`,
            [regla.id, estadoPrevio],
        );
        return filas.length > 0;
    }

    // Una sola sentencia: cabecera y filas salen de la misma instantánea aunque otra petición guarde en medio.
    private async leer(where: string, params: string[]): Promise<ReglaZona[]> {
        const reglas = await this.gestor.query<FilaBdReglaConFilas[]>(
            `SELECT ${COLUMNAS}, ${FILAS_AGREGADAS} FROM reglas_zona ${where} ORDER BY tipo_enfermedad ASC, version DESC`,
            params,
        );
        return reglas.map((r) =>
            aDominio(
                r,
                r.filas.map((f) => ({ ...f, regla_id: r.id })),
            ),
        );
    }

    private async insertarFilas(reglaId: string, filas: FilaRegla[]) {
        const valores: (string | number)[] = [reglaId];
        const tuplas = filas.map((f) => {
            const base = valores.length;
            valores.push(f.orden, f.sevMax, f.incMax, f.radioMinM, f.radioMaxM);
            return `($1,$${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5})`;
        });
        await this.gestor.query(`INSERT INTO reglas_zona_filas (${COLUMNAS_FILA}) VALUES ${tuplas.join(",")}`, valores);
    }
}
