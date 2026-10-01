import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { QueryFailedError, Repository, type FindOptionsWhere } from "typeorm";
import type { FiltrosModelo, IModeloIaRepository } from "../../../../domain/ports/out/modelo-ia.repository";
import type { ModeloIa } from "../../../../domain/entities/modelo-ia.entity";
import { TypeOrmModeloIaEntity } from "./typeorm-modelo-ia.entity";
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
        const entity = await this.modeloRepository.findOne({ where: { id } });
        return entity ? modeloADominio(entity) : null;
    }

    async findByVersion(version: string): Promise<ModeloIa | null> {
        const entity = await this.modeloRepository.findOne({ where: { version } });
        return entity ? modeloADominio(entity) : null;
    }

    async findAll(filtros: FiltrosModelo = {}): Promise<ModeloIa[]> {
        const where: FindOptionsWhere<TypeOrmModeloIaEntity> = {};
        if (filtros.canal) where.canal = filtros.canal;

        const entities = await this.modeloRepository.find({ where, order: { fechaCreacion: "DESC" } });
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
}
