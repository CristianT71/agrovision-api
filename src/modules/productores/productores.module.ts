import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { TypeOrmProductorEntity } from "./infrastructure/adapters/out/persistence/typeorm-productor.entity";
import { TypeOrmProductorRepository } from "./infrastructure/adapters/out/persistence/typeorm-productor.repository";

import { PRODUCTOR_REPOSITORY } from "./domain/ports/out/productor.repository";

@Module({
    imports: [TypeOrmModule.forFeature([TypeOrmProductorEntity])],
    controllers: [],
    providers: [
        {
            provide: PRODUCTOR_REPOSITORY,
            useClass: TypeOrmProductorRepository,
        },
    ],
    // Otros módulos necesitan el puerto (ej. consulta de productores desde solicitudes)
    exports: [PRODUCTOR_REPOSITORY],
})
export class ProductoresModule {}
