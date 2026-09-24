import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { TypeOrmProductorEntity } from "./infrastructure/adapters/out/persistence/typeorm-productor.entity";
import { TypeOrmProductorRepository } from "./infrastructure/adapters/out/persistence/typeorm-productor.repository";
import { ProductoresController } from "./infrastructure/adapters/in/http/productores.controller";

import { PRODUCTOR_REPOSITORY } from "./domain/ports/out/productor.repository";

// Casos de uso
import { CompletarPerfilProductorService } from "./application/use-cases/completar-perfil-productor.service";
import { ListarProductoresService } from "./application/use-cases/listar-productores.service";
import { ObtenerProductorService } from "./application/use-cases/obtener-productor.service";
import { ValidarProductorService } from "./application/use-cases/validar-productor.service";
import { ConsentimientoProductorService } from "./application/use-cases/consentimiento-productor.service";

@Module({
    imports: [TypeOrmModule.forFeature([TypeOrmProductorEntity])],
    controllers: [ProductoresController],
    providers: [
        CompletarPerfilProductorService,
        ListarProductoresService,
        ObtenerProductorService,
        ValidarProductorService,
        ConsentimientoProductorService,
        {
            provide: PRODUCTOR_REPOSITORY,
            useClass: TypeOrmProductorRepository,
        },
    ],
    // Otros módulos necesitan el puerto (ej. consulta de productores desde solicitudes)
    exports: [PRODUCTOR_REPOSITORY],
})
export class ProductoresModule {}
