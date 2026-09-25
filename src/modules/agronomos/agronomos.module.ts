import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { TypeOrmAgronomoEntity } from "./infrastructure/adapters/out/persistence/typeorm-agronomo.entity";
import { TypeOrmDocumentoAgronomoEntity } from "./infrastructure/adapters/out/persistence/typeorm-documento-agronomo.entity";
import { TypeOrmAgronomoRepository } from "./infrastructure/adapters/out/persistence/typeorm-agronomo.repository";
import { RegistroAgronomoController } from "./infrastructure/adapters/in/http/registro-agronomo.controller";
import { AgronomosController } from "./infrastructure/adapters/in/http/agronomos.controller";
import { AlmacenamientoModule } from "../../common/almacenamiento/almacenamiento.module";

import { AGRONOMO_REPOSITORY } from "./domain/ports/out/agronomo.repository";

// Casos de uso
import { RegistrarAgronomoService } from "./application/use-cases/registrar-agronomo.service";
import { ListarAgronomosService } from "./application/use-cases/listar-agronomos.service";
import { ObtenerAgronomoService } from "./application/use-cases/obtener-agronomo.service";
import { CambiarEstadoAgronomoService } from "./application/use-cases/cambiar-estado-agronomo.service";
import { DescargarDocumentoAgronomoService } from "./application/use-cases/descargar-documento-agronomo.service";

@Module({
    imports: [TypeOrmModule.forFeature([TypeOrmAgronomoEntity, TypeOrmDocumentoAgronomoEntity]), AlmacenamientoModule],
    controllers: [RegistroAgronomoController, AgronomosController],
    providers: [
        RegistrarAgronomoService,
        ListarAgronomosService,
        ObtenerAgronomoService,
        CambiarEstadoAgronomoService,
        DescargarDocumentoAgronomoService,
        {
            provide: AGRONOMO_REPOSITORY,
            useClass: TypeOrmAgronomoRepository,
        },
    ],
    // Otros módulos necesitan el puerto (ej. asignación de casos a agrónomos)
    exports: [AGRONOMO_REPOSITORY],
})
export class AgronomosModule {}
