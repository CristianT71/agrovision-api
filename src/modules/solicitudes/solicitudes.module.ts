import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { TypeOrmSolicitudEntity } from "./infrastructure/adapters/out/persistence/typeorm-solicitud.entity";
import { TypeOrmSolicitudRepository } from "./infrastructure/adapters/out/persistence/typeorm-solicitud.repository";
import { SolicitudesController } from "./infrastructure/adapters/in/http/solicitudes.controller";

import { SOLICITUD_REPOSITORY } from "./domain/ports/out/solicitud.repository";
import { AgronomosModule } from "../agronomos/agronomos.module";

// Casos de uso
import { ResolverSolicitudService } from "./application/use-cases/resolver-solicitud.service";
import { ListarSolicitudesService } from "./application/use-cases/listar-solicitudes.service";
import { ObtenerSolicitudPorIdService } from "./application/use-cases/obtener-solicitud-por-id.service";

@Module({
    // Se necesita el agrónomo del usuario autenticado para resolver y filtrar (RF-03.3)
    imports: [TypeOrmModule.forFeature([TypeOrmSolicitudEntity]), AgronomosModule],
    controllers: [SolicitudesController],
    providers: [
        ResolverSolicitudService,
        ListarSolicitudesService,
        ObtenerSolicitudPorIdService,
        {
            provide: SOLICITUD_REPOSITORY,
            useClass: TypeOrmSolicitudRepository,
        },
    ],
    exports: [ResolverSolicitudService, ListarSolicitudesService, ObtenerSolicitudPorIdService],
})
export class SolicitudesModule {}
