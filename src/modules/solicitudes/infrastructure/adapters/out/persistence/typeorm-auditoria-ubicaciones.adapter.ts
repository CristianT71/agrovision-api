import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { v4 as uuidv4 } from "uuid";
import type {
    IAuditoriaUbicaciones,
    RegistroConsultaUbicacion,
} from "../../../../domain/ports/out/auditoria-ubicaciones.port";
import { TypeOrmAuditoriaUbicacionEntity } from "./typeorm-auditoria-ubicacion.entity";

@Injectable()
export class TypeOrmAuditoriaUbicacionesAdapter implements IAuditoriaUbicaciones {
    constructor(
        @InjectRepository(TypeOrmAuditoriaUbicacionEntity)
        private readonly repository: Repository<TypeOrmAuditoriaUbicacionEntity>,
    ) {}

    async registrar(registro: RegistroConsultaUbicacion): Promise<void> {
        // insert y no save: el log es de solo inserción
        await this.repository.insert({ id: uuidv4(), ...registro, fecha: new Date() });
    }
}
