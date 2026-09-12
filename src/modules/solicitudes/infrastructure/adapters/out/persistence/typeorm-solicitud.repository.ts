import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ISolicitudRepository } from "../../../../domain/ports/out/solicitud.repository";
import { Solicitud, EstadoSolicitud } from "../../../../domain/entities/solicitud.entity";
import { TypeOrmSolicitudEntity } from "./typeorm-solicitud.entity";

@Injectable()
export class TypeOrmSolicitudRepository implements ISolicitudRepository {
    constructor(
        @InjectRepository(TypeOrmSolicitudEntity)
        private readonly repository: Repository<TypeOrmSolicitudEntity>,
    ) {}

    async findById(id: string): Promise<Solicitud | null> {
        const entity = await this.repository.findOne({ where: { id } });
        if (!entity) return null;

        // Mapper: Convierte el Esquema de TypeORM a Entidad pura de Dominio
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
            entity.tipoResultado,
        );
    }

    async findAll(filtros?: { estado?: EstadoSolicitud; agronomoId?: string }): Promise<Solicitud[]> {
        const where: any = {};
        if (filtros?.estado) where.estado = filtros.estado;
        if (filtros?.agronomoId) where.agronomoId = filtros.agronomoId;

        const entities = await this.repository.find({ where });

        return entities.map(
            (e) =>
                new Solicitud(
                    e.id,
                    e.productorId,
                    e.agronomoId,
                    e.estado as EstadoSolicitud,
                    e.fecha,
                    e.municipio,
                    e.vereda,
                    e.finca,
                    e.confianzaIa,
                    e.modeloVersionId,
                    e.respuestaProfesional,
                    e.tipoResultado,
                ),
        );
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
        });
    }
}
