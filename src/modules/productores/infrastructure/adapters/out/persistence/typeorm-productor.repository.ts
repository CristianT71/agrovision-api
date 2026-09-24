import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { FindOptionsWhere, ILike, Repository } from "typeorm";
import { IProductorRepository, FiltrosProductor } from "../../../../domain/ports/out/productor.repository";
import { Productor, EstadoProductor } from "../../../../domain/entities/productor.entity";
import { TypeOrmProductorEntity } from "./typeorm-productor.entity";

@Injectable()
export class TypeOrmProductorRepository implements IProductorRepository {
    constructor(
        @InjectRepository(TypeOrmProductorEntity)
        private readonly repository: Repository<TypeOrmProductorEntity>,
    ) {}

    // Mapper: Convierte el Esquema de TypeORM a Entidad pura de Dominio
    private toDomain(entity: TypeOrmProductorEntity): Productor {
        return new Productor(
            entity.id,
            entity.usuarioId,
            entity.nombre,
            entity.finca,
            entity.vereda,
            entity.municipio,
            entity.telefono,
            entity.estado as EstadoProductor,
            entity.consentimiento,
            entity.fechaConsentimiento,
        );
    }

    async findById(id: string): Promise<Productor | null> {
        const entity = await this.repository.findOne({ where: { id } });
        if (!entity) return null;

        return this.toDomain(entity);
    }

    async findByUsuarioId(usuarioId: string): Promise<Productor | null> {
        const entity = await this.repository.findOne({ where: { usuarioId } });
        if (!entity) return null;

        return this.toDomain(entity);
    }

    async findByTelefono(telefono: string): Promise<Productor | null> {
        const entity = await this.repository.findOne({ where: { telefono } });
        if (!entity) return null;

        return this.toDomain(entity);
    }

    async findAll(filtros?: FiltrosProductor): Promise<Productor[]> {
        const base: FindOptionsWhere<TypeOrmProductorEntity> = {};
        if (filtros?.estado) base.estado = filtros.estado;
        // "consentimiento" es booleano: false también es un filtro válido
        if (filtros?.consentimiento !== undefined) base.consentimiento = filtros.consentimiento;
        if (filtros?.municipio) base.municipio = filtros.municipio;

        // Búsqueda libre (RF-03.5): el OR entre nombre y finca se expresa como
        // un arreglo de condiciones, repitiendo en cada una el resto de filtros
        const where = filtros?.busqueda
            ? [
                  { ...base, nombre: ILike(`%${filtros.busqueda}%`) },
                  { ...base, finca: ILike(`%${filtros.busqueda}%`) },
              ]
            : base;

        const entities = await this.repository.find({
            where,
            order: { nombre: "ASC" },
        });

        return entities.map((entity) => this.toDomain(entity));
    }

    async guardar(productor: Productor): Promise<Productor> {
        // Mapper inverso: Convierte Entidad de Dominio a esquema persistible de TypeORM
        const saved = await this.repository.save({
            id: productor.id,
            usuarioId: productor.usuarioId,
            nombre: productor.nombre,
            finca: productor.finca,
            vereda: productor.vereda,
            municipio: productor.municipio,
            telefono: productor.telefono,
            estado: productor.estado,
            consentimiento: productor.consentimiento,
            fechaConsentimiento: productor.fechaConsentimiento,
        });

        return this.toDomain(saved);
    }
}
