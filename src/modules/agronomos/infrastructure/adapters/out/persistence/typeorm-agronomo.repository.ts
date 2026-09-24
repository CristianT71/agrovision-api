import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { FindOptionsWhere, Repository } from "typeorm";
import { IAgronomoRepository, FiltrosAgronomo } from "../../../../domain/ports/out/agronomo.repository";
import { Agronomo, EstadoAgronomo } from "../../../../domain/entities/agronomo.entity";
import { TypeOrmAgronomoEntity } from "./typeorm-agronomo.entity";

@Injectable()
export class TypeOrmAgronomoRepository implements IAgronomoRepository {
    constructor(
        @InjectRepository(TypeOrmAgronomoEntity)
        private readonly repository: Repository<TypeOrmAgronomoEntity>,
    ) {}

    // Mapper: Convierte el Esquema de TypeORM a Entidad pura de Dominio
    private toDomain(entity: TypeOrmAgronomoEntity): Agronomo {
        return new Agronomo(
            entity.id,
            entity.usuarioId,
            entity.nombre,
            entity.tarjetaProfesional,
            entity.telefono,
            entity.correo,
            entity.especialidad,
            entity.estado as EstadoAgronomo,
            entity.fechaAlta,
        );
    }

    async findById(id: string): Promise<Agronomo | null> {
        const entity = await this.repository.findOne({ where: { id } });
        if (!entity) return null;

        return this.toDomain(entity);
    }

    async findByUsuarioId(usuarioId: string): Promise<Agronomo | null> {
        const entity = await this.repository.findOne({ where: { usuarioId } });
        if (!entity) return null;

        return this.toDomain(entity);
    }

    async findByTarjetaProfesional(tarjeta: string): Promise<Agronomo | null> {
        const entity = await this.repository.findOne({ where: { tarjetaProfesional: tarjeta } });
        if (!entity) return null;

        return this.toDomain(entity);
    }

    async findAll(filtros?: FiltrosAgronomo): Promise<Agronomo[]> {
        const where: FindOptionsWhere<TypeOrmAgronomoEntity> = {};
        if (filtros?.estado) where.estado = filtros.estado;
        if (filtros?.especialidad) where.especialidad = filtros.especialidad;

        const entities = await this.repository.find({
            where,
            order: { fechaAlta: "DESC" },
        });

        return entities.map((entity) => this.toDomain(entity));
    }

    async guardar(agronomo: Agronomo): Promise<Agronomo> {
        // Mapper inverso: Convierte Entidad de Dominio a esquema persistible de TypeORM
        const saved = await this.repository.save({
            id: agronomo.id,
            usuarioId: agronomo.usuarioId,
            nombre: agronomo.nombre,
            tarjetaProfesional: agronomo.tarjetaProfesional,
            telefono: agronomo.telefono,
            correo: agronomo.correo,
            especialidad: agronomo.especialidad,
            estado: agronomo.estado,
            fechaAlta: agronomo.fechaAlta,
        });

        return this.toDomain(saved);
    }
}
