import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { AjustesPersonales, AjustesSistema } from "../../../../domain/ajustes";
import type { IAjustesRepository } from "../../../../domain/ports/out/ajustes.repository";
import { TypeOrmAjustesSistemaEntity, TypeOrmAjustesUsuarioEntity } from "./typeorm-ajustes.entity";

const ID_SISTEMA = 1;

@Injectable()
export class TypeOrmAjustesRepository implements IAjustesRepository {
    constructor(
        @InjectRepository(TypeOrmAjustesUsuarioEntity)
        private readonly usuarios: Repository<TypeOrmAjustesUsuarioEntity>,
        @InjectRepository(TypeOrmAjustesSistemaEntity)
        private readonly sistema: Repository<TypeOrmAjustesSistemaEntity>,
    ) {}

    async obtenerPersonales(usuarioId: string): Promise<Partial<AjustesPersonales>> {
        const fila = await this.usuarios.findOneBy({ usuarioId });
        return fila?.datos ?? {};
    }

    async guardarPersonales(usuarioId: string, ajustes: Partial<AjustesPersonales>): Promise<void> {
        await this.usuarios.save({ usuarioId, datos: ajustes, fechaActualizacion: new Date() });
    }

    async obtenerSistema(): Promise<Partial<AjustesSistema>> {
        const fila = await this.sistema.findOneBy({ id: ID_SISTEMA });
        return fila?.datos ?? {};
    }

    async guardarSistema(ajustes: Partial<AjustesSistema>, usuarioId: string): Promise<void> {
        await this.sistema.save({
            id: ID_SISTEMA,
            datos: ajustes,
            actualizadoPor: usuarioId,
            fechaActualizacion: new Date(),
        });
    }
}
