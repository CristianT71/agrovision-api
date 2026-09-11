import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TypeOrmSolicitudEntity } from "./infrastructure/adapters/out/persistence/typeorm-solicitud.entity";
import { TypeOrmSolicitudRepository } from "./infrastructure/adapters/out/persistence/typeorm-solicitud.repository";
import { SolicitudesController } from "./infrastructure/adapters/in/http/solicitudes.controller";
import { SOLICITUD_REPOSITORY } from "./domain/ports/out/solicitud.repository";
import { ResolverSolicitudService } from "./application/use-cases/resolver-solicitud.service";

@Module({
    imports: [TypeOrmModule.forFeature([TypeOrmSolicitudEntity])],
    controllers: [SolicitudesController],
    providers: [
        ResolverSolicitudService,
        // VINCULACIÓN HEXAGONAL: Conectamos la Interfaz (Puerto) con la Implementación (Adaptador)
        {
            provide: SOLICITUD_REPOSITORY,
            useClass: TypeOrmSolicitudRepository,
        },
    ],
    exports: [ResolverSolicitudService],
})
export class SolicitudesModule {}
