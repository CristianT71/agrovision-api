import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { QueryFailedError, Repository, type EntityManager, type FindOptionsWhere } from "typeorm";
import { v4 as uuidv4 } from "uuid";
import type { FiltrosModelo, IModeloIaRepository } from "../../../../domain/ports/out/modelo-ia.repository";
import type { ModeloIa } from "../../../../domain/entities/modelo-ia.entity";
import { RegistroAuditoria, type AccionAuditoria } from "../../../../domain/entities/registro-auditoria.entity";
import { TypeOrmModeloIaEntity } from "./typeorm-modelo-ia.entity";
import { TypeOrmMetricaModeloEntity } from "./typeorm-metrica-modelo.entity";
import { TypeOrmAuditoriaModeloEntity } from "./typeorm-auditoria-modelo.entity";
import { modeloADominio, modeloAPersistencia } from "./modelo-ia.mapper";

// Código de PostgreSQL para una violación de restricción UNIQUE
const VIOLACION_UNICA = "23505";

function esViolacionUnica(error: unknown): boolean {
    return error instanceof QueryFailedError && (error.driverError as { code?: string }).code === VIOLACION_UNICA;
}

@Injectable()
export class TypeOrmModeloIaRepository implements IModeloIaRepository {
    constructor(
        @InjectRepository(TypeOrmModeloIaEntity)
        private readonly modeloRepository: Repository<TypeOrmModeloIaEntity>,
        @InjectRepository(TypeOrmAuditoriaModeloEntity)
        private readonly auditoriaRepository: Repository<TypeOrmAuditoriaModeloEntity>,
    ) {}

    async findById(id: string): Promise<ModeloIa | null> {
        const entity = await this.modeloRepository.findOne({ where: { id }, relations: { metricas: true } });
        return entity ? modeloADominio(entity) : null;
    }

    async findByVersion(version: string): Promise<ModeloIa | null> {
        const entity = await this.modeloRepository.findOne({ where: { version }, relations: { metricas: true } });
        return entity ? modeloADominio(entity) : null;
    }

    async findAll(filtros: FiltrosModelo = {}): Promise<ModeloIa[]> {
        const where: FindOptionsWhere<TypeOrmModeloIaEntity> = {};
        if (filtros.canal) where.canal = filtros.canal;

        const entities = await this.modeloRepository.find({
            where,
            relations: { metricas: true },
            order: { fechaCreacion: "DESC" },
        });
        return entities.map(modeloADominio);
    }

    async crear(modelo: ModeloIa, auditoria: RegistroAuditoria): Promise<boolean> {
        try {
            await this.modeloRepository.manager.transaction(async (manager) => {
                await manager.insert(TypeOrmModeloIaEntity, modeloAPersistencia(modelo));
                await this.insertarAuditoria(manager, [auditoria]);
            });
            return true;
        } catch (error) {
            if (esViolacionUnica(error)) return false;
            throw error;
        }
    }

    async guardarMetricas(modelo: ModeloIa, auditoria: RegistroAuditoria): Promise<void> {
        // Se reemplazan completas en una transacción: nunca quedan mezcladas la versión vieja y la nueva
        await this.modeloRepository.manager.transaction(async (manager) => {
            await manager.delete(TypeOrmMetricaModeloEntity, { modeloId: modelo.id });
            await manager.insert(
                TypeOrmMetricaModeloEntity,
                modelo.metricas.map((metrica) => ({
                    id: uuidv4(),
                    modeloId: modelo.id,
                    clase: metrica.clase,
                    precision: metrica.precision,
                    recall: metrica.recall,
                    f1: metrica.f1,
                })),
            );
            await this.insertarAuditoria(manager, [auditoria]);
        });
    }

    async guardarCambios(modelos: ModeloIa[], auditorias: RegistroAuditoria[]): Promise<boolean> {
        try {
            await this.modeloRepository.manager.transaction(async (manager) => {
                // En orden: el modelo retirado deja libre su canal antes de que otro lo ocupe
                for (const modelo of modelos) {
                    const { id, ...columnas } = modeloAPersistencia(modelo);
                    await manager.update(TypeOrmModeloIaEntity, { id }, columnas);
                }
                await this.insertarAuditoria(manager, auditorias);
            });
            return true;
        } catch (error) {
            // Los índices únicos parciales de canario y producción
            if (esViolacionUnica(error)) return false;
            throw error;
        }
    }

    async listarAuditoria(modeloId: string): Promise<RegistroAuditoria[]> {
        const entities = await this.auditoriaRepository.find({ where: { modeloId }, order: { fecha: "DESC" } });

        return entities.map(
            (entity) =>
                new RegistroAuditoria(
                    entity.id,
                    entity.modeloId,
                    entity.accion as AccionAuditoria,
                    entity.actorUsuarioId,
                    entity.motivo,
                    // jsonb: PostgreSQL devuelve el mismo objeto que se guardó
                    entity.detalle as Record<string, unknown> | null,
                    entity.fecha,
                ),
        );
    }

    private async insertarAuditoria(manager: EntityManager, auditorias: RegistroAuditoria[]): Promise<void> {
        if (auditorias.length === 0) return;

        await manager.insert(
            TypeOrmAuditoriaModeloEntity,
            auditorias.map((auditoria) => ({
                id: auditoria.id,
                modeloId: auditoria.modeloId,
                accion: auditoria.accion,
                actorUsuarioId: auditoria.actorUsuarioId,
                motivo: auditoria.motivo,
                detalle: auditoria.detalle,
                fecha: auditoria.fecha,
            })),
        );
    }
}
