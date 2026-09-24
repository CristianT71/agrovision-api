import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { FindOptionsWhere, Repository } from "typeorm";
import { ISolicitudRepository, FiltrosSolicitud } from "../../../../domain/ports/out/solicitud.repository";
import { Solicitud, EstadoSolicitud, TipoResultado } from "../../../../domain/entities/solicitud.entity";
import { TypeOrmSolicitudEntity } from "./typeorm-solicitud.entity";

@Injectable()
export class TypeOrmSolicitudRepository implements ISolicitudRepository {
    constructor(
        @InjectRepository(TypeOrmSolicitudEntity)
        private readonly repository: Repository<TypeOrmSolicitudEntity>,
    ) {}

    // Mapper: Convierte el Esquema de TypeORM a Entidad pura de Dominio
    private toDomain(entity: TypeOrmSolicitudEntity): Solicitud {
        return new Solicitud(
            entity.id,
            entity.productorId,
            entity.agronomoId,
            entity.estado as EstadoSolicitud,
            entity.fecha,
            entity.municipio,
            entity.vereda,
            entity.finca,
            entity.confianzaIa,
            entity.modeloVersionId,
            entity.respuestaProfesional,
            entity.tipoResultado as TipoResultado | null,
            entity.plagaIdentificada,
            entity.fechaResolucion,
        );
    }

    async findById(id: string): Promise<Solicitud | null> {
        const entity = await this.repository.findOne({ where: { id } });
        if (!entity) return null;

        return this.toDomain(entity);
    }

    async findAll(filtros?: FiltrosSolicitud): Promise<Solicitud[]> {
        const where: FindOptionsWhere<TypeOrmSolicitudEntity> = {};
        if (filtros?.estado) where.estado = filtros.estado;
        if (filtros?.agronomoId) where.agronomoId = filtros.agronomoId;

        // Las más recientes primero en la bandeja
        const entities = await this.repository.find({ where, order: { fecha: "DESC" } });

        return entities.map((entity) => this.toDomain(entity));
    }

    async guardar(solicitud: Solicitud): Promise<void> {
        // Mapper inverso: Convierte Entidad de Dominio a esquema persistible de TypeORM
        await this.repository.save({
            id: solicitud.id,
            productorId: solicitud.productorId,
            agronomoId: solicitud.agronomoId,
            estado: solicitud.estado,
            fecha: solicitud.fecha,
            municipio: solicitud.municipio,
            vereda: solicitud.vereda,
            finca: solicitud.finca,
            confianzaIa: solicitud.confianzaIa,
            modeloVersionId: solicitud.modeloVersionId,
            respuestaProfesional: solicitud.respuestaProfesional,
            tipoResultado: solicitud.tipoResultado,
            plagaIdentificada: solicitud.plagaIdentificada,
            fechaResolucion: solicitud.fechaResolucion,
        });
    }

    async guardarResolucion(solicitud: Solicitud): Promise<boolean> {
        if (!solicitud.agronomoId) return false;

        // UPDATE condicionado: solo pasa si la fila sigue "Asignada" al mismo agrónomo,
        // así dos resoluciones simultáneas no se pisan (RF-04.8)
        const resultado = await this.repository.update(
            { id: solicitud.id, estado: "Asignada", agronomoId: solicitud.agronomoId },
            {
                estado: solicitud.estado,
                respuestaProfesional: solicitud.respuestaProfesional,
                tipoResultado: solicitud.tipoResultado,
                plagaIdentificada: solicitud.plagaIdentificada,
                fechaResolucion: solicitud.fechaResolucion,
            },
        );

        return (resultado.affected ?? 0) > 0;
    }
}
