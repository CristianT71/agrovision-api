import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type {
    DeteccionLeida,
    FiltrosDetecciones,
    ILecturaDetecciones,
    ResumenCategoria,
} from "../../../../domain/ports/out/lectura-detecciones.port";
import { Deteccion } from "../../../../domain/entities/deteccion.entity";
import type { Categoria, ResultadoCompuerta } from "../../../../domain/services/categoria-biologica";
import type { Cultivo, Organo } from "../../../../../solicitudes/domain/entities/solicitud.entity";
import { TypeOrmDeteccionEntity } from "./typeorm-deteccion.entity";

// RF-07.3 en SQL, para filtrar y contar sin traer todas las filas. Es la misma regla de
// evaluarDivergencia (domain/services/divergencia.ts): si cambia una, debe cambiar la otra.
const EXPRESION_REVISION = `CASE
    WHEN r.tipo_resultado IN ('Corrige diagnóstico IA', 'Plaga nueva') THEN 'divergente'
    WHEN r.tipo_resultado = 'Planta sana' AND d.tipo <> 'sano' THEN 'divergente'
    WHEN r.tipo_resultado IN ('Confirma diagnóstico IA', 'Planta sana') THEN 'coincide'
    WHEN d.correccion_productor IS NOT NULL AND d.correccion_productor IS DISTINCT FROM d.clase_predicha THEN 'divergente'
    WHEN d.correccion_productor IS NOT NULL OR d.confirmada_productor THEN 'coincide'
    ELSE 'sin_revision'
END`;

// La solicitud resuelta más reciente abierta desde la captura (solicitudes.captura_id = id de la app)
const ORIGEN = `FROM detecciones_app d
    LEFT JOIN productores p ON p.id = d.productor_id
    LEFT JOIN LATERAL (
        SELECT s.id, s.tipo_resultado, s.plaga_identificada
        FROM solicitudes s
        WHERE s.captura_id = d.id_cliente AND s.estado = 'Resuelta'
        ORDER BY s.fecha_resolucion DESC NULLS LAST
        LIMIT 1
    ) r ON true`;

interface FilaDeteccion {
    id: string;
    id_cliente: string;
    productor_id: string;
    municipio: string;
    tipo: string;
    clase_predicha: string | null;
    confianza: number | null;
    puntaje_ood: number;
    resultado_compuerta: string;
    modelo_id: string | null;
    modelo_version: string;
    correccion_productor: string | null;
    confirmada_productor: boolean;
    cultivo: string | null;
    organo: string | null;
    latitud: number | null;
    longitud: number | null;
    precision_metros: number | null;
    fecha: Date;
    recibida_en: Date;
    defectuosa: boolean;
    productor_nombre: string | null;
    solicitud_id: string | null;
    resultado_agronomo: string | null;
    plaga_agronomo: string | null;
}

@Injectable()
export class TypeOrmLecturaDeteccionesAdapter implements ILecturaDetecciones {
    constructor(
        @InjectRepository(TypeOrmDeteccionEntity)
        private readonly deteccionRepository: Repository<TypeOrmDeteccionEntity>,
    ) {}

    async listar(
        filtros: FiltrosDetecciones,
        pagina: { numero: number; limite: number },
    ): Promise<{ total: number; filas: DeteccionLeida[] }> {
        const { where, params } = this.construirWhere(filtros);

        const [conteo, filas] = await Promise.all([
            this.deteccionRepository.query<{ total: number }[]>(
                `SELECT COUNT(*)::int AS total ${ORIGEN} ${where}`,
                params,
            ),
            this.deteccionRepository.query<FilaDeteccion[]>(
                `${this.seleccion()} ${ORIGEN} ${where}
                 ORDER BY d.fecha DESC, d.id
                 LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
                [...params, pagina.limite, (pagina.numero - 1) * pagina.limite],
            ),
        ]);

        return { total: conteo[0]?.total ?? 0, filas: filas.map((fila) => this.aLeida(fila)) };
    }

    async obtener(id: string): Promise<DeteccionLeida | null> {
        const filas = await this.deteccionRepository.query<FilaDeteccion[]>(
            `${this.seleccion()} ${ORIGEN} WHERE d.id = $1`,
            [id],
        );

        return filas[0] ? this.aLeida(filas[0]) : null;
    }

    async resumir(filtros: FiltrosDetecciones): Promise<ResumenCategoria[]> {
        const { where, params } = this.construirWhere(filtros);

        const filas = await this.deteccionRepository.query<
            { categoria: string; total: number; divergentes: number; defectuosas: number }[]
        >(
            `SELECT d.tipo AS categoria,
                    COUNT(*)::int AS total,
                    (COUNT(*) FILTER (WHERE (${EXPRESION_REVISION}) = 'divergente'))::int AS divergentes,
                    (COUNT(*) FILTER (WHERE d.defectuosa))::int AS defectuosas
             ${ORIGEN} ${where}
             GROUP BY d.tipo
             ORDER BY total DESC`,
            params,
        );

        return filas.map((fila) => ({ ...fila, categoria: fila.categoria as Categoria }));
    }

    // Columnas explícitas: el embedding se deja fuera (el monitor no lo muestra y pesa en cada fila)
    private seleccion(): string {
        return `SELECT d.id, d.id_cliente, d.productor_id, d.municipio, d.tipo, d.clase_predicha, d.confianza,
                       d.puntaje_ood, d.resultado_compuerta, d.modelo_id, d.modelo_version,
                       d.correccion_productor, d.confirmada_productor, d.cultivo, d.organo, d.latitud,
                       d.longitud, d.precision_metros, d.fecha, d.recibida_en, d.defectuosa,
                       p.nombre AS productor_nombre, r.id AS solicitud_id,
                       r.tipo_resultado AS resultado_agronomo, r.plaga_identificada AS plaga_agronomo`;
    }

    // Todos los valores viajan como parámetros ($1, $2...): nada del cliente se concatena al SQL
    private construirWhere(filtros: FiltrosDetecciones): { where: string; params: unknown[] } {
        const condiciones: string[] = [];
        const params: unknown[] = [];
        const parametro = (valor: unknown): string => {
            params.push(valor);
            return `$${params.length}`;
        };

        // RF-07.2: incluir agrupa (OR) y excluir quita (AND NOT)
        if (filtros.incluir?.length) condiciones.push(`d.tipo = ANY(${parametro(filtros.incluir)})`);
        if (filtros.excluir?.length) condiciones.push(`NOT (d.tipo = ANY(${parametro(filtros.excluir)}))`);
        if (filtros.revision) condiciones.push(`(${EXPRESION_REVISION}) = ${parametro(filtros.revision)}`);
        if (filtros.defectuosas !== undefined) condiciones.push(`d.defectuosa = ${parametro(filtros.defectuosas)}`);
        if (filtros.modeloVersion) condiciones.push(`d.modelo_version = ${parametro(filtros.modeloVersion)}`);
        if (filtros.municipio) condiciones.push(`LOWER(d.municipio) = LOWER(${parametro(filtros.municipio)})`);
        if (filtros.desde) condiciones.push(`d.fecha >= ${parametro(filtros.desde)}`);
        if (filtros.hasta) condiciones.push(`d.fecha <= ${parametro(filtros.hasta)}`);

        return { where: condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "", params };
    }

    private aLeida(fila: FilaDeteccion): DeteccionLeida {
        return {
            deteccion: new Deteccion(
                fila.id,
                fila.id_cliente,
                fila.productor_id,
                fila.municipio,
                fila.tipo as Categoria,
                fila.clase_predicha,
                fila.confianza,
                fila.puntaje_ood,
                fila.resultado_compuerta as ResultadoCompuerta,
                fila.modelo_id,
                fila.modelo_version,
                fila.correccion_productor,
                fila.confirmada_productor,
                fila.cultivo as Cultivo | null,
                fila.organo as Organo | null,
                fila.latitud,
                fila.longitud,
                fila.precision_metros,
                null,
                fila.fecha,
                fila.recibida_en,
                fila.defectuosa,
            ),
            productorNombre: fila.productor_nombre,
            solicitudId: fila.solicitud_id,
            resultadoAgronomo: fila.resultado_agronomo,
            plagaAgronomo: fila.plaga_agronomo,
        };
    }
}
