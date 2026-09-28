import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { IPermisoContactoRepository } from "../../../../domain/ports/out/permiso-contacto.repository";
import { PermisoContacto } from "../../../../domain/entities/permiso-contacto.entity";
import { TypeOrmPermisoContactoEntity } from "./typeorm-permiso-contacto.entity";

@Injectable()
export class TypeOrmPermisoContactoRepository implements IPermisoContactoRepository {
    constructor(
        @InjectRepository(TypeOrmPermisoContactoEntity)
        private readonly permisoRepository: Repository<TypeOrmPermisoContactoEntity>,
    ) {}

    // Mapper: Convierte el Esquema de TypeORM a Entidad pura de Dominio
    private toDomain(entity: TypeOrmPermisoContactoEntity): PermisoContacto {
        return new PermisoContacto(
            entity.id,
            entity.solicitudId,
            entity.agronomoId,
            entity.habilitado,
            entity.otorgadoPor,
            entity.fechaOtorgado,
            entity.revocadoPor,
            entity.fechaRevocado,
        );
    }

    async findBySolicitudId(solicitudId: string): Promise<PermisoContacto | null> {
        const entity = await this.permisoRepository.findOne({ where: { solicitudId } });
        if (!entity) return null;

        return this.toDomain(entity);
    }

    async guardar(permiso: PermisoContacto): Promise<PermisoContacto> {
        // Upsert por solicitud_id: si dos administradores otorgan el primer permiso a la vez,
        // la segunda escritura actualiza la fila en lugar de chocar con la restricción única.
        // El id no se sobrescribe: la fila conserva el de su primera inserción.
        await this.permisoRepository
            .createQueryBuilder()
            .insert()
            .into(TypeOrmPermisoContactoEntity)
            .values({
                id: permiso.id,
                solicitudId: permiso.solicitudId,
                agronomoId: permiso.agronomoId,
                habilitado: permiso.habilitado,
                otorgadoPor: permiso.otorgadoPor,
                fechaOtorgado: permiso.fechaOtorgado,
                revocadoPor: permiso.revocadoPor,
                fechaRevocado: permiso.fechaRevocado,
            })
            .orUpdate(
                ["agronomo_id", "habilitado", "otorgado_por", "fecha_otorgado", "revocado_por", "fecha_revocado"],
                ["solicitud_id"],
            )
            .execute();

        // Se relee para devolver la fila real (su id es el de la primera inserción)
        const guardado = await this.findBySolicitudId(permiso.solicitudId);

        return guardado ?? permiso;
    }
}
