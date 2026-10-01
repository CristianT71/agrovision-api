import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";

import { TypeOrmModeloIaEntity } from "./infrastructure/adapters/out/persistence/typeorm-modelo-ia.entity";
import { TypeOrmMetricaModeloEntity } from "./infrastructure/adapters/out/persistence/typeorm-metrica-modelo.entity";
import { TypeOrmAuditoriaModeloEntity } from "./infrastructure/adapters/out/persistence/typeorm-auditoria-modelo.entity";
import { TypeOrmModeloIaRepository } from "./infrastructure/adapters/out/persistence/typeorm-modelo-ia.repository";
import { Ed25519FirmadorModelosAdapter } from "./infrastructure/adapters/out/firmador/ed25519-firmador-modelos.adapter";
import { ModelosController } from "./infrastructure/adapters/in/http/modelos.controller";
import { AlmacenamientoModule } from "../../common/almacenamiento/almacenamiento.module";

import { MODELO_IA_REPOSITORY } from "./domain/ports/out/modelo-ia.repository";
import { FIRMADOR_MODELOS } from "./domain/ports/out/firmador-modelos.port";

// Casos de uso
import { SubirModeloService } from "./application/use-cases/subir-modelo.service";
import { ListarModelosService } from "./application/use-cases/listar-modelos.service";
import { ObtenerModeloService } from "./application/use-cases/obtener-modelo.service";
import { RegistrarMetricasService } from "./application/use-cases/registrar-metricas.service";
import { CambiarCanalService } from "./application/use-cases/cambiar-canal.service";
import { ListarAuditoriaModeloService } from "./application/use-cases/listar-auditoria-modelo.service";
import { ActivarKillSwitchService } from "./application/use-cases/activar-kill-switch.service";

@Module({
    // Los artefactos van a almacenamiento privado y se firman con la clave de MODEL_SIGNING_PRIVATE_KEY
    imports: [
        TypeOrmModule.forFeature([TypeOrmModeloIaEntity, TypeOrmMetricaModeloEntity, TypeOrmAuditoriaModeloEntity]),
        AlmacenamientoModule,
        ConfigModule,
    ],
    controllers: [ModelosController],
    providers: [
        SubirModeloService,
        ListarModelosService,
        ObtenerModeloService,
        RegistrarMetricasService,
        CambiarCanalService,
        ListarAuditoriaModeloService,
        ActivarKillSwitchService,
        {
            provide: MODELO_IA_REPOSITORY,
            useClass: TypeOrmModeloIaRepository,
        },
        {
            provide: FIRMADOR_MODELOS,
            useClass: Ed25519FirmadorModelosAdapter,
        },
    ],
})
export class ModelosIaModule {}
