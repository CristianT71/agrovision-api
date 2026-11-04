import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type {
    AceptacionPoliticaDatos,
    IPoliticaDatosRepository,
} from "../../../../domain/ports/out/politica-datos.repository";
import { TypeOrmUsuarioEntity } from "./typeorm-usuario.entity";

@Injectable()
export class TypeOrmPoliticaDatosRepository implements IPoliticaDatosRepository {
    constructor(
        @InjectRepository(TypeOrmUsuarioEntity)
        private readonly repository: Repository<TypeOrmUsuarioEntity>,
    ) {}

    async obtener(usuarioId: string): Promise<AceptacionPoliticaDatos | null> {
        const entity = await this.repository.findOne({ where: { id: usuarioId } });
        if (!entity) return null;

        return { version: entity.politicaDatosVersion, fecha: entity.politicaDatosFecha };
    }

    async registrar(usuarioId: string, version: string, fecha: Date): Promise<void> {
        await this.repository.update({ id: usuarioId }, { politicaDatosVersion: version, politicaDatosFecha: fecha });
    }

    async revocar(usuarioId: string): Promise<void> {
        await this.repository.update({ id: usuarioId }, { politicaDatosVersion: null, politicaDatosFecha: null });
    }
}
