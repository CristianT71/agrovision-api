import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { TypeOrmPlagaEntity } from "./infrastructure/adapters/out/persistence/typeorm-plaga.entity";
import { TypeOrmSinonimoPlagaEntity } from "./infrastructure/adapters/out/persistence/typeorm-sinonimo-plaga.entity";
import { TypeOrmAvalPlagaEntity } from "./infrastructure/adapters/out/persistence/typeorm-aval-plaga.entity";
import { TypeOrmPlagaRepository } from "./infrastructure/adapters/out/persistence/typeorm-plaga.repository";
import { PlagasController } from "./infrastructure/adapters/in/http/plagas.controller";
import { AgronomosModule } from "../agronomos/agronomos.module";
import { AlmacenamientoModule } from "../../common/almacenamiento/almacenamiento.module";

import { PLAGA_REPOSITORY } from "./domain/ports/out/plaga.repository";

// Casos de uso
import { ListarPlagasService } from "./application/use-cases/listar-plagas.service";
import { ObtenerPlagaService } from "./application/use-cases/obtener-plaga.service";
import { CrearPlagaService } from "./application/use-cases/crear-plaga.service";
import { ActualizarPlagaService } from "./application/use-cases/actualizar-plaga.service";
import { AvalarPlagaService } from "./application/use-cases/avalar-plaga.service";
import { ActualizarProtocoloQuimicoService } from "./application/use-cases/actualizar-protocolo-quimico.service";
import { SubirFotoPlagaService } from "./application/use-cases/subir-foto-plaga.service";

@Module({
    imports: [
        TypeOrmModule.forFeature([TypeOrmPlagaEntity, TypeOrmSinonimoPlagaEntity, TypeOrmAvalPlagaEntity]),
        // El aval necesita el agrónomo firmante (RF-05.7)
        AgronomosModule,
        AlmacenamientoModule,
    ],
    controllers: [PlagasController],
    providers: [
        ListarPlagasService,
        ObtenerPlagaService,
        CrearPlagaService,
        ActualizarPlagaService,
        AvalarPlagaService,
        ActualizarProtocoloQuimicoService,
        SubirFotoPlagaService,
        {
            provide: PLAGA_REPOSITORY,
            useClass: TypeOrmPlagaRepository,
        },
    ],
    // Otros módulos necesitan el puerto (ej. detecciones y solicitudes)
    exports: [PLAGA_REPOSITORY],
})
export class PlagasModule {}
