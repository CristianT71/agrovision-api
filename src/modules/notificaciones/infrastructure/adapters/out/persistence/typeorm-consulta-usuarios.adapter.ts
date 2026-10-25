import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import type { IConsultaUsuarios } from "../../../../domain/ports/out/consulta-usuarios.port";
import { TypeOrmUsuarioEntity } from "../../../../../autenticacion/infrastructure/adapters/out/persistence/typeorm-usuario.entity";

// SOLO lectura sobre usuarios: notificaciones nunca escribe en las cuentas
@Injectable()
export class TypeOrmConsultaUsuariosAdapter implements IConsultaUsuarios {
    constructor(
        @InjectRepository(TypeOrmUsuarioEntity)
        private readonly usuarioRepository: Repository<TypeOrmUsuarioEntity>,
    ) {}

    // Solo las cuentas activas reciben avisos: una pendiente o inactiva no entra al panel
    async listarIdsActivosPorRol(rol: string): Promise<string[]> {
        const filas = await this.usuarioRepository.find({
            select: { id: true },
            where: { rol, estado: "activo" },
        });

        return filas.map((fila) => fila.id);
    }

    async obtenerCorreosDeAviso(usuarioIds: string[]): Promise<{ usuarioId: string; correo: string }[]> {
        if (usuarioIds.length === 0) return [];

        const filas = await this.usuarioRepository.find({
            select: { id: true, correo: true },
            where: { id: In(usuarioIds), correoNotificaciones: true, estado: "activo" },
        });

        return filas.flatMap((fila) => (fila.correo ? [{ usuarioId: fila.id, correo: fila.correo }] : []));
    }
}
