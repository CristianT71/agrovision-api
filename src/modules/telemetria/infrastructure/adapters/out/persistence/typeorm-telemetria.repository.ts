import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { ITelemetriaRepository } from "../../../../domain/ports/out/telemetria.repository";
import type { EventoTelemetria } from "../../../../domain/entities/evento-telemetria.entity";
import type { ConteoActualizacion, ConteoModelo, VentanaTiempo } from "../../../../domain/services/indicadores";
import { TypeOrmEventoTelemetriaEntity } from "./typeorm-evento-telemetria.entity";

interface FilaModelo {
    version_modelo: string;
    escaneos: string;
    identificados: string;
    rechazados_por_calidad: string;
    correcciones: string;
    latencia_promedio_ms: string | null;
}

interface FilaActualizacion {
    version_destino: string;
    exitos: string;
    fallos: string;
}

@Injectable()
export class TypeOrmTelemetriaRepository implements ITelemetriaRepository {
    constructor(
        @InjectRepository(TypeOrmEventoTelemetriaEntity)
        private readonly repository: Repository<TypeOrmEventoTelemetriaEntity>,
    ) {}

    async guardar(evento: EventoTelemetria): Promise<void> {
        await this.repository.insert({ id: evento.id, ...evento.datos, recibidoEn: evento.recibidoEn });
    }

    // Una sola consulta con conteos condicionales; PostgreSQL devuelve COUNT y AVG como texto
    async contarPorModelo(ventana: VentanaTiempo): Promise<ConteoModelo[]> {
        const filas = await this.repository
            .createQueryBuilder("e")
            .select("e.version_modelo", "version_modelo")
            .addSelect("COUNT(*) FILTER (WHERE e.tipo = 'scan')", "escaneos")
            .addSelect("COUNT(*) FILTER (WHERE e.tipo = 'scan' AND e.resultado = 'IDENTIFIED')", "identificados")
            .addSelect(
                "COUNT(*) FILTER (WHERE e.tipo = 'scan' AND e.resultado = 'QUALITY_REJECTED')",
                "rechazados_por_calidad",
            )
            .addSelect("COUNT(*) FILTER (WHERE e.tipo = 'correction')", "correcciones")
            .addSelect("AVG(e.latencia_ms) FILTER (WHERE e.tipo = 'scan')", "latencia_promedio_ms")
            .where("e.tipo IN ('scan', 'correction')")
            .andWhere("e.ocurrido_en >= :desde AND e.ocurrido_en < :hasta", ventana)
            .groupBy("e.version_modelo")
            .orderBy("e.version_modelo", "DESC")
            .getRawMany<FilaModelo>();

        return filas.map((f) => ({
            versionModelo: f.version_modelo,
            escaneos: Number(f.escaneos),
            identificados: Number(f.identificados),
            rechazadosPorCalidad: Number(f.rechazados_por_calidad),
            correcciones: Number(f.correcciones),
            latenciaPromedioMs: f.latencia_promedio_ms === null ? null : Math.round(Number(f.latencia_promedio_ms)),
        }));
    }

    async contarActualizaciones(ventana: VentanaTiempo): Promise<ConteoActualizacion[]> {
        const filas = await this.repository
            .createQueryBuilder("e")
            .select("e.version_destino", "version_destino")
            .addSelect("COUNT(*) FILTER (WHERE e.exito = true)", "exitos")
            .addSelect("COUNT(*) FILTER (WHERE e.exito = false)", "fallos")
            .where("e.tipo = 'model_update'")
            .andWhere("e.ocurrido_en >= :desde AND e.ocurrido_en < :hasta", ventana)
            .groupBy("e.version_destino")
            .orderBy("e.version_destino", "DESC")
            .getRawMany<FilaActualizacion>();

        return filas.map((f) => ({
            versionDestino: f.version_destino,
            exitos: Number(f.exitos),
            fallos: Number(f.fallos),
        }));
    }
}
