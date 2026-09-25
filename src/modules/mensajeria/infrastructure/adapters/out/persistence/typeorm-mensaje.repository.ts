import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { IMensajeRepository, PendientesPorSolicitud } from "../../../../domain/ports/out/mensaje.repository";
import { Mensaje, type AutorTipo } from "../../../../domain/entities/mensaje.entity";
import { AdjuntoMensaje, type TipoAdjunto } from "../../../../domain/entities/adjunto-mensaje.entity";
import { TypeOrmMensajeEntity } from "./typeorm-mensaje.entity";

@Injectable()
export class TypeOrmMensajeRepository implements IMensajeRepository {
    constructor(
        @InjectRepository(TypeOrmMensajeEntity)
        private readonly mensajeRepository: Repository<TypeOrmMensajeEntity>,
    ) {}

    // Mapper: Convierte el Esquema de TypeORM a Entidad pura de Dominio
    private toDomain(entity: TypeOrmMensajeEntity): Mensaje {
        const adjuntos = (entity.adjuntos ?? []).map(
            (adjunto) =>
                new AdjuntoMensaje(
                    adjunto.id,
                    adjunto.mensajeId,
                    adjunto.ruta,
                    adjunto.nombreArchivo,
                    adjunto.tipoMime,
                    adjunto.tamanoBytes,
                    adjunto.tipo as TipoAdjunto,
                ),
        );

        return new Mensaje(
            entity.id,
            entity.solicitudId,
            entity.autorId,
            entity.autorTipo as AutorTipo,
            entity.contenido,
            entity.fecha,
            entity.leido,
            adjuntos,
        );
    }

    async guardar(mensaje: Mensaje): Promise<Mensaje> {
        // Los adjuntos se insertan en la misma operación (cascade: ["insert"])
        const entity = this.mensajeRepository.create({
            id: mensaje.id,
            solicitudId: mensaje.solicitudId,
            autorId: mensaje.autorId,
            autorTipo: mensaje.autorTipo,
            contenido: mensaje.contenido,
            fecha: mensaje.fecha,
            leido: mensaje.leido,
            adjuntos: mensaje.adjuntos.map((adjunto) => ({
                id: adjunto.id,
                mensajeId: mensaje.id,
                ruta: adjunto.ruta,
                nombreArchivo: adjunto.nombreArchivo,
                tipoMime: adjunto.tipoMime,
                tamanoBytes: adjunto.tamanoBytes,
                tipo: adjunto.tipo,
            })),
        });

        await this.mensajeRepository.save(entity);

        return this.toDomain(entity);
    }

    async findById(id: string): Promise<Mensaje | null> {
        const entity = await this.mensajeRepository.findOne({ where: { id }, relations: { adjuntos: true } });
        if (!entity) return null;

        return this.toDomain(entity);
    }

    async listarPorSolicitud(solicitudId: string): Promise<Mensaje[]> {
        const entities = await this.mensajeRepository.find({
            where: { solicitudId },
            relations: { adjuntos: true },
            order: { fecha: "ASC" },
        });

        return entities.map((entity) => this.toDomain(entity));
    }

    async marcarLeidos(solicitudId: string, lector: AutorTipo): Promise<number> {
        // Un solo UPDATE: nunca se cargan los mensajes para actualizarlos uno por uno
        const resultado = await this.mensajeRepository
            .createQueryBuilder()
            .update(TypeOrmMensajeEntity)
            .set({ leido: true })
            .where("solicitud_id = :solicitudId", { solicitudId })
            .andWhere("autor_tipo <> :lector", { lector })
            .andWhere("leido = false")
            .execute();

        return resultado.affected ?? 0;
    }

    async contarPendientes(lector: AutorTipo, solicitudIds?: string[]): Promise<PendientesPorSolicitud[]> {
        // "IN ()" no es SQL válido: sin ids que consultar no hay pendientes posibles
        if (solicitudIds && solicitudIds.length === 0) return [];

        const consulta = this.mensajeRepository
            .createQueryBuilder("mensaje")
            .select("mensaje.solicitud_id", "solicitudId")
            .addSelect("COUNT(*)", "pendientes")
            .where("mensaje.autor_tipo <> :lector", { lector })
            .andWhere("mensaje.leido = false")
            .groupBy("mensaje.solicitud_id");

        if (solicitudIds) {
            consulta.andWhere("mensaje.solicitud_id IN (:...solicitudIds)", { solicitudIds });
        }

        const filas = await consulta.getRawMany<{ solicitudId: string; pendientes: string }>();

        // PostgreSQL devuelve COUNT como string
        return filas.map((fila) => ({ solicitudId: fila.solicitudId, pendientes: Number(fila.pendientes) }));
    }
}
