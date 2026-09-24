import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { TypeOrmAgronomoEntity } from "./infrastructure/adapters/out/persistence/typeorm-agronomo.entity";
import { TypeOrmAgronomoRepository } from "./infrastructure/adapters/out/persistence/typeorm-agronomo.repository";

import { AGRONOMO_REPOSITORY } from "./domain/ports/out/agronomo.repository";

@Module({
    imports: [TypeOrmModule.forFeature([TypeOrmAgronomoEntity])],
    controllers: [],
    providers: [
        {
            provide: AGRONOMO_REPOSITORY,
            useClass: TypeOrmAgronomoRepository,
        },
    ],
    // Otros módulos necesitan el puerto (ej. asignación de casos a agrónomos)
    exports: [AGRONOMO_REPOSITORY],
})
export class AgronomosModule {}
