import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { IPreferenciasCorreo, PreferenciaCorreo } from "../../../../domain/ports/out/preferencias-correo.port";
import { TypeOrmUsuarioEntity } from "../../../../../autenticacion/infrastructure/adapters/out/persistence/typeorm-usuario.entity";

@Injectable()
export class TypeOrmPreferenciasCorreoAdapter implements IPreferenciasCorreo {
    constructor(
        @InjectRepository(TypeOrmUsuarioEntity)
        private readonly usuarioRepository: Repository<TypeOrmUsuarioEntity>,
    ) {}

    async obtener(usuarioId: string): Promise<PreferenciaCorreo> {
        const usuario = await this.usuarioRepository.findOne({
            select: { correo: true, correoNotificaciones: true },
            where: { id: usuarioId },
        });
        return { activo: usuario?.correoNotificaciones ?? false, correo: usuario?.correo ?? null };
    }

    async guardar(usuarioId: string, preferencia: PreferenciaCorreo): Promise<void> {
        await this.usuarioRepository.update(
            { id: usuarioId },
            { correo: preferencia.correo, correoNotificaciones: preferencia.activo },
        );
    }
}
