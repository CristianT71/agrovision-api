import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { QueryFailedError, Repository, type FindOptionsWhere } from "typeorm";
import { v4 as uuidv4 } from "uuid";
import type { FiltrosModelo, IModeloIaRepository } from "../../../../domain/ports/out/modelo-ia.repository";
import type { ModeloIa } from "../../../../domain/entities/modelo-ia.entity";
import { TypeOrmModeloIaEntity } from "./typeorm-modelo-ia.entity";
import { TypeOrmMetricaModeloEntity } from "./typeorm-metrica-modelo.entity";
import { modeloADominio, modeloAPersistencia } from "./modelo-ia.mapper";

// Código de PostgreSQL para una violación de restricción UNIQUE
const VIOLACION_UNICA = "23505";

@Injectable()
export class TypeOrmModeloIaRepository implements IModeloIaRepository {
    constructor(
        @InjectRepository(TypeOrmModeloIaEntity)
        private readonly modeloRepository: Repository<TypeOrmModeloIaEntity>,
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

    async crear(modelo: ModeloIa): Promise<boolean> {
        try {
            await this.modeloRepository.insert(modeloAPersistencia(modelo));
            return true;
        } catch (error) {
            if (
                error instanceof QueryFailedError &&
                (error.driverError as { code?: string }).code === VIOLACION_UNICA
            ) {
                return false;
            }
            throw error;
        }
    }

    async guardarMetricas(modelo: ModeloIa): Promise<void> {
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
        });
    }
}
