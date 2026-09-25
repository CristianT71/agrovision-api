import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { TypeOrmSolicitudEntity } from "./infrastructure/adapters/out/persistence/typeorm-solicitud.entity";
import { TypeOrmSolicitudRepository } from "./infrastructure/adapters/out/persistence/typeorm-solicitud.repository";
import { SolicitudesController } from "./infrastructure/adapters/in/http/solicitudes.controller";
import { NotificacionesSolicitudesAdapter } from "./infrastructure/adapters/out/notificaciones/notificaciones.adapter";

import { SOLICITUD_REPOSITORY } from "./domain/ports/out/solicitud.repository";
import { NOTIFICADOR_SOLICITUDES } from "./domain/ports/out/notificador-solicitudes.port";
import { AgronomosModule } from "../agronomos/agronomos.module";
import { NotificacionesModule } from "../notificaciones/notificaciones.module";

// Casos de uso
import { ResolverSolicitudService } from "./application/use-cases/resolver-solicitud.service";
import { ListarSolicitudesService } from "./application/use-cases/listar-solicitudes.service";
import { ObtenerSolicitudPorIdService } from "./application/use-cases/obtener-solicitud-por-id.service";
import { AsignarSolicitudService } from "./application/use-cases/asignar-solicitud.service";

@Module({
    // Se necesita el agrónomo del usuario autenticado para resolver y filtrar (RF-03.3)
    // y avisarle cuando se le asigna un caso (RF-02.5)
    imports: [TypeOrmModule.forFeature([TypeOrmSolicitudEntity]), AgronomosModule, NotificacionesModule],
    controllers: [SolicitudesController],
    providers: [
        ResolverSolicitudService,
        ListarSolicitudesService,
        ObtenerSolicitudPorIdService,
        AsignarSolicitudService,
        {
            provide: SOLICITUD_REPOSITORY,
            useClass: TypeOrmSolicitudRepository,
        },
        {
            provide: NOTIFICADOR_SOLICITUDES,
            useClass: NotificacionesSolicitudesAdapter,
        },
    ],
    exports: [ResolverSolicitudService, ListarSolicitudesService, ObtenerSolicitudPorIdService],
})
export class SolicitudesModule {}
