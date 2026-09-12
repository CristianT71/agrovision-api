import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { IUsuarioRepository } from "../../../../domain/ports/out/usuario.repository";
import { Usuario, type RolUsuario, type EstadoUsuario } from "../../../../domain/entities/usuario.entity";
import { TypeOrmUsuarioEntity } from "./typeorm-usuario.entity";

@Injectable()
export class TypeOrmUsuarioRepository implements IUsuarioRepository {
    constructor(
        @InjectRepository(TypeOrmUsuarioEntity)
        private readonly repository: Repository<TypeOrmUsuarioEntity>,
    ) {}

    async findByTelefono(telefono: string): Promise<Usuario | null> {
        const entity = await this.repository.findOne({ where: { telefono } });
        if (!entity) return null;

        return new Usuario(
            entity.id,
            entity.telefono,
            entity.rol as RolUsuario,
            entity.estado as EstadoUsuario,
            entity.fechaRegistro,
        );
    }

    async findById(id: string): Promise<Usuario | null> {
        const entity = await this.repository.findOne({ where: { id } });
        if (!entity) return null;

        return new Usuario(
            entity.id,
            entity.telefono,
            entity.rol as RolUsuario,
            entity.estado as EstadoUsuario,
            entity.fechaRegistro,
        );
    }

    async guardar(usuario: Usuario): Promise<Usuario> {
        const saved = await this.repository.save({
            id: usuario.id,
            telefono: usuario.telefono,
            rol: usuario.rol,
            estado: usuario.estado,
            fechaRegistro: usuario.fechaRegistro,
        });

        return new Usuario(saved.id, saved.telefono, saved.rol, saved.estado, saved.fechaRegistro);
    }
}
