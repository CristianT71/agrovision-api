import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { TypeOrmPlagaEntity } from "./infrastructure/adapters/out/persistence/typeorm-plaga.entity";
import { TypeOrmSinonimoPlagaEntity } from "./infrastructure/adapters/out/persistence/typeorm-sinonimo-plaga.entity";
import { TypeOrmAvalPlagaEntity } from "./infrastructure/adapters/out/persistence/typeorm-aval-plaga.entity";
import { TypeOrmPlagaRepository } from "./infrastructure/adapters/out/persistence/typeorm-plaga.repository";

import { PLAGA_REPOSITORY } from "./domain/ports/out/plaga.repository";

@Module({
    imports: [TypeOrmModule.forFeature([TypeOrmPlagaEntity, TypeOrmSinonimoPlagaEntity, TypeOrmAvalPlagaEntity])],
    controllers: [],
    providers: [
        {
            provide: PLAGA_REPOSITORY,
            useClass: TypeOrmPlagaRepository,
        },
    ],
    // Otros módulos necesitan el puerto (ej. detecciones y solicitudes)
    exports: [PLAGA_REPOSITORY],
})
export class PlagasModule {}
