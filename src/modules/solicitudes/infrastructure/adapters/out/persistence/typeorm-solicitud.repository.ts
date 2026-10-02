import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { FindOptionsWhere, IsNull, Repository } from "typeorm";
import { ISolicitudRepository, FiltrosSolicitud } from "../../../../domain/ports/out/solicitud.repository";
import { Solicitud, EstadoSolicitud } from "../../../../domain/entities/solicitud.entity";
import { TypeOrmSolicitudEntity } from "./typeorm-solicitud.entity";
import { TypeOrmAnexoResolucionEntity } from "./typeorm-anexo-resolucion.entity";
import type { AnexoResolucion } from "../../../../domain/entities/anexo-resolucion.entity";
import { solicitudADominio, solicitudAPersistencia } from "./solicitud.mapper";

@Injectable()
export class TypeOrmSolicitudRepository implements ISolicitudRepository {
    constructor(
        @InjectRepository(TypeOrmSolicitudEntity)
        private readonly repository: Repository<TypeOrmSolicitudEntity>,
    ) {}

    async findById(id: string): Promise<Solicitud | null> {
        const entity = await this.repository.findOne({ where: { id } });
        if (!entity) return null;

        return solicitudADominio(entity);
    }

    async findAll(filtros?: FiltrosSolicitud): Promise<Solicitud[]> {
        const where: FindOptionsWhere<TypeOrmSolicitudEntity> = {};
        if (filtros?.estado) where.estado = filtros.estado;
        if (filtros?.agronomoId) where.agronomoId = filtros.agronomoId;

        // Las más recientes primero en la bandeja
        const entities = await this.repository.find({ where, order: { fecha: "DESC" } });

        return entities.map((entity) => solicitudADominio(entity));
    }

    async guardar(solicitud: Solicitud): Promise<void> {
        // Mapper inverso: Convierte Entidad de Dominio a esquema persistible de TypeORM
        await this.repository.save(solicitudAPersistencia(solicitud));
    }

    async guardarResolucion(solicitud: Solicitud, anexos: AnexoResolucion[] = []): Promise<boolean> {
        const agronomoId = solicitud.agronomoId;
        if (!agronomoId) return false;

        // Todo o nada: la resolución y sus anexos se confirman juntos
        return await this.repository.manager.transaction(async (manager) => {
            // UPDATE condicionado: solo pasa si la fila sigue "Asignada" al mismo agrónomo,
            // así dos resoluciones simultáneas no se pisan (RF-04.8)
            const resultado = await manager.update(
                TypeOrmSolicitudEntity,
                { id: solicitud.id, estado: "Asignada", agronomoId },
                {
                    estado: solicitud.estado,
                    respuestaProfesional: solicitud.respuestaProfesional,
                    tipoResultado: solicitud.tipoResultado,
                    plagaIdentificada: solicitud.plagaIdentificada,
                    fechaResolucion: solicitud.fechaResolucion,
                },
            );

            if ((resultado.affected ?? 0) === 0) return false;

            if (anexos.length > 0) {
                await manager.insert(
                    TypeOrmAnexoResolucionEntity,
                    anexos.map((anexo) => ({
                        id: anexo.id,
                        solicitudId: anexo.solicitudId,
                        ruta: anexo.ruta,
                        nombreOriginal: anexo.nombreOriginal,
                        tipoMime: anexo.tipoMime,
                        tamanoBytes: anexo.tamanoBytes,
                        fechaSubida: anexo.fechaSubida,
                    })),
                );
            }

            return true;
        });
    }

    async guardarAsignacion(
        solicitud: Solicitud,
        anterior: { estado: EstadoSolicitud; agronomoId: string | null },
    ): Promise<boolean> {
        // UPDATE condicionado: solo pasa si la fila sigue en el estado y con el agrónomo leídos.
        // Solo toca agronomo_id y estado para no borrar una resolución que llegue en paralelo (RF-08.3)
        const resultado = await this.repository.update(
            {
                id: solicitud.id,
                estado: anterior.estado,
                agronomoId: anterior.agronomoId === null ? IsNull() : anterior.agronomoId,
            },
            {
                agronomoId: solicitud.agronomoId,
                estado: solicitud.estado,
            },
        );

        return (resultado.affected ?? 0) > 0;
    }
}
