import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { ICapturaModeloRepository } from "../../../../domain/ports/out/captura-modelo.repository";
import { TypeOrmModeloIaEntity } from "../../../../../modelos-ia/infrastructure/adapters/out/persistence/typeorm-modelo-ia.entity";
import { TypeOrmDeteccionEntity } from "../../../../../detecciones/infrastructure/adapters/out/persistence/typeorm-deteccion.entity";

@Injectable()
export class TypeOrmCapturaModeloRepository implements ICapturaModeloRepository {
    constructor(
        @InjectRepository(TypeOrmDeteccionEntity)
        private readonly repository: Repository<TypeOrmDeteccionEntity>,
        @InjectRepository(TypeOrmModeloIaEntity)
        private readonly modelos: Repository<TypeOrmModeloIaEntity>,
    ) {}

    async obtenerModeloIdPorIdCliente(idCliente: string | null): Promise<string | null> {
        if (!idCliente) return null;

        const captura = await this.repository.findOne({
            select: { modeloId: true },
            where: { idCliente },
        });
        return captura?.modeloId ?? null;
    }

    async obtenerModeloIdPorVersion(version: string | null): Promise<string | null> {
        if (!version) return null;

        const modelo = await this.modelos.findOne({ select: { id: true }, where: { version } });
        return modelo?.id ?? null;
    }
}
