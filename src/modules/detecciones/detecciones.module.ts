import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { TypeOrmDeteccionEntity } from "./infrastructure/adapters/out/persistence/typeorm-deteccion.entity";
import { TypeOrmDeteccionRepository } from "./infrastructure/adapters/out/persistence/typeorm-deteccion.repository";
import { ModelosConsultaAdapter } from "./infrastructure/adapters/out/modelos/modelos-consulta.adapter";
import { AppCapturasController } from "./infrastructure/adapters/in/app-movil/app-capturas.controller";

import { DETECCION_REPOSITORY } from "./domain/ports/out/deteccion.repository";
import { CONSULTA_MODELOS } from "./domain/ports/out/consulta-modelos.port";

import { ProductoresModule } from "../productores/productores.module";
import { ModelosIaModule } from "../modelos-ia/modelos-ia.module";

// Casos de uso
import { RecibirCapturasService } from "./application/use-cases/recibir-capturas.service";

@Module({
    // La captura se asocia al productor del token y a la versión del inventario de modelos
    imports: [TypeOrmModule.forFeature([TypeOrmDeteccionEntity]), ProductoresModule, ModelosIaModule],
    controllers: [AppCapturasController],
    providers: [
        RecibirCapturasService,
        {
            provide: DETECCION_REPOSITORY,
            useClass: TypeOrmDeteccionRepository,
        },
        {
            provide: CONSULTA_MODELOS,
            useClass: ModelosConsultaAdapter,
        },
    ],
})
export class DeteccionesModule {}
