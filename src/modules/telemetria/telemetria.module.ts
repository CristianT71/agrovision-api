import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { TypeOrmEventoTelemetriaEntity } from "./infrastructure/adapters/out/persistence/typeorm-evento-telemetria.entity";
import { TypeOrmTelemetriaRepository } from "./infrastructure/adapters/out/persistence/typeorm-telemetria.repository";
import { AppTelemetriaController } from "./infrastructure/adapters/in/app-movil/app-telemetria.controller";
import { TelemetriaController } from "./infrastructure/adapters/in/http/telemetria.controller";
import { TELEMETRIA_REPOSITORY } from "./domain/ports/out/telemetria.repository";

// Casos de uso
import { RegistrarEventoService } from "./application/use-cases/registrar-evento.service";
import { ResumirTelemetriaService } from "./application/use-cases/resumir-telemetria.service";

@Module({
    imports: [TypeOrmModule.forFeature([TypeOrmEventoTelemetriaEntity])],
    controllers: [AppTelemetriaController, TelemetriaController],
    providers: [
        RegistrarEventoService,
        ResumirTelemetriaService,
        {
            provide: TELEMETRIA_REPOSITORY,
            useClass: TypeOrmTelemetriaRepository,
        },
    ],
})
export class TelemetriaModule {}
