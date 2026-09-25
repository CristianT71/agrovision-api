import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type {
    FiltrosNotificacion,
    INotificacionRepository,
} from "../../../../domain/ports/out/notificacion.repository";
import {
    Notificacion,
    type TipoNotificacion,
    type TipoReferencia,
} from "../../../../domain/entities/notificacion.entity";
import { TypeOrmNotificacionEntity } from "./typeorm-notificacion.entity";

@Injectable()
export class TypeOrmNotificacionRepository implements INotificacionRepository {
    constructor(
        @InjectRepository(TypeOrmNotificacionEntity)
        private readonly notificacionRepository: Repository<TypeOrmNotificacionEntity>,
    ) {}

    // Mapper: Convierte el Esquema de TypeORM a Entidad pura de Dominio
    private toDomain(entity: TypeOrmNotificacionEntity): Notificacion {
        return new Notificacion(
            entity.id,
            entity.usuarioId,
            entity.tipo as TipoNotificacion,
            entity.titulo,
            entity.descripcion,
            entity.referenciaTipo as TipoReferencia | null,
            entity.referenciaId,
            entity.leida,
            entity.fecha,
        );
    }

    private aPersistencia(notificacion: Notificacion): TypeOrmNotificacionEntity {
        return this.notificacionRepository.create({
            id: notificacion.id,
            usuarioId: notificacion.usuarioId,
            tipo: notificacion.tipo,
            titulo: notificacion.titulo,
            descripcion: notificacion.descripcion,
            referenciaTipo: notificacion.referenciaTipo,
            referenciaId: notificacion.referenciaId,
            leida: notificacion.leida,
            fecha: notificacion.fecha,
        });
    }

    async guardarVarias(notificaciones: Notificacion[]): Promise<void> {
        // Sin nada que guardar no se toca la base
        if (notificaciones.length === 0) return;

        // Un solo INSERT para todo el lote
        await this.notificacionRepository.insert(notificaciones.map((n) => this.aPersistencia(n)));
    }

    async findById(id: string): Promise<Notificacion | null> {
        const entity = await this.notificacionRepository.findOne({ where: { id } });
        if (!entity) return null;

        return this.toDomain(entity);
    }

    async guardar(notificacion: Notificacion): Promise<Notificacion> {
        const entity = this.aPersistencia(notificacion);

        await this.notificacionRepository.save(entity);

        return this.toDomain(entity);
    }

    async listarPorUsuario(
        usuarioId: string,
        filtros: FiltrosNotificacion,
    ): Promise<{ items: Notificacion[]; total: number }> {
        const [entities, total] = await this.notificacionRepository.findAndCount({
            where: filtros.soloNoLeidas ? { usuarioId, leida: false } : { usuarioId },
            // Lo más reciente primero: así se ve la campana
            order: { fecha: "DESC" },
            skip: (filtros.pagina - 1) * filtros.limite,
            take: filtros.limite,
        });

        return { items: entities.map((entity) => this.toDomain(entity)), total };
    }

    async contarNoLeidas(usuarioId: string): Promise<number> {
        return await this.notificacionRepository.count({ where: { usuarioId, leida: false } });
    }

    async marcarTodasLeidas(usuarioId: string): Promise<number> {
        // Un solo UPDATE: nunca se cargan las notificaciones para actualizarlas una por una
        const resultado = await this.notificacionRepository
            .createQueryBuilder()
            .update(TypeOrmNotificacionEntity)
            .set({ leida: true })
            .where("usuario_id = :usuarioId", { usuarioId })
            .andWhere("leida = false")
            .execute();

        return resultado.affected ?? 0;
    }

    async existeNoLeida(usuarioId: string, tipo: TipoNotificacion, referenciaId: string): Promise<boolean> {
        return await this.notificacionRepository.exists({
            where: { usuarioId, tipo, referenciaId, leida: false },
        });
    }
}
