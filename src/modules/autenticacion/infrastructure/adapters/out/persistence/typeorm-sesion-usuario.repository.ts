import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Repository } from "typeorm";
import type { ISesionUsuarioRepository } from "../../../../domain/ports/out/sesion-usuario.repository";
import { SesionUsuario } from "../../../../domain/entities/sesion-usuario.entity";
import type { RolUsuario } from "../../../../domain/entities/usuario.entity";
import { TypeOrmSesionUsuarioEntity } from "./typeorm-sesion-usuario.entity";

@Injectable()
export class TypeOrmSesionUsuarioRepository implements ISesionUsuarioRepository {
    constructor(
        @InjectRepository(TypeOrmSesionUsuarioEntity)
        private readonly repository: Repository<TypeOrmSesionUsuarioEntity>,
    ) {}

    async crear(sesion: SesionUsuario): Promise<void> {
        await this.repository.insert({
            id: sesion.id,
            usuarioId: sesion.usuarioId,
            rol: sesion.rol,
            creadaEn: sesion.creadaEn,
            expiraEn: sesion.expiraEn,
            ultimaActividad: sesion.ultimaActividad,
            revocadaEn: sesion.revocadaEn,
        });
    }

    async findById(id: string): Promise<SesionUsuario | null> {
        const entity = await this.repository.findOne({ where: { id } });
        if (!entity) return null;

        return new SesionUsuario(
            entity.id,
            entity.usuarioId,
            entity.rol as RolUsuario,
            entity.creadaEn,
            entity.expiraEn,
            entity.ultimaActividad,
            entity.revocadaEn,
        );
    }

    async registrarActividad(id: string, fecha: Date): Promise<void> {
        await this.repository.update({ id, revocadaEn: IsNull() }, { ultimaActividad: fecha });
    }

    async revocar(id: string, fecha: Date): Promise<void> {
        await this.repository.update({ id, revocadaEn: IsNull() }, { revocadaEn: fecha });
    }
}
