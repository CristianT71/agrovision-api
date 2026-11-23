import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AjustesService } from "./application/use-cases/ajustes.service";
import { AJUSTES_REPOSITORY } from "./domain/ports/out/ajustes.repository";
import { AjustesController } from "./infrastructure/adapters/in/http/ajustes.controller";
import {
    TypeOrmAjustesSistemaEntity,
    TypeOrmAjustesUsuarioEntity,
} from "./infrastructure/adapters/out/persistence/typeorm-ajustes.entity";
import { TypeOrmAjustesRepository } from "./infrastructure/adapters/out/persistence/typeorm-ajustes.repository";

@Module({
    imports: [TypeOrmModule.forFeature([TypeOrmAjustesUsuarioEntity, TypeOrmAjustesSistemaEntity])],
    controllers: [AjustesController],
    providers: [AjustesService, { provide: AJUSTES_REPOSITORY, useClass: TypeOrmAjustesRepository }],
    // Otros módulos leen la configuración del sistema (asignación automática, carga máxima)
    exports: [AjustesService],
})
export class AjustesModule {}
