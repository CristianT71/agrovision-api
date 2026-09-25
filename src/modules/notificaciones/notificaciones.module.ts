import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { TypeOrmNotificacionEntity } from "./infrastructure/adapters/out/persistence/typeorm-notificacion.entity";
import { TypeOrmNotificacionRepository } from "./infrastructure/adapters/out/persistence/typeorm-notificacion.repository";
import { TypeOrmConsultaUsuariosAdapter } from "./infrastructure/adapters/out/persistence/typeorm-consulta-usuarios.adapter";
import { TypeOrmUsuarioEntity } from "../autenticacion/infrastructure/adapters/out/persistence/typeorm-usuario.entity";
import { NotificacionesController } from "./infrastructure/adapters/in/http/notificaciones.controller";

import { NOTIFICACION_REPOSITORY } from "./domain/ports/out/notificacion.repository";
import { CONSULTA_USUARIOS } from "./domain/ports/out/consulta-usuarios.port";

// Casos de uso
import { CrearNotificacionesService } from "./application/use-cases/crear-notificaciones.service";
import { ListarNotificacionesService } from "./application/use-cases/listar-notificaciones.service";
import { ContarNoLeidasService } from "./application/use-cases/contar-no-leidas.service";
import { MarcarNotificacionLeidaService } from "./application/use-cases/marcar-notificacion-leida.service";
import { MarcarTodasLeidasService } from "./application/use-cases/marcar-todas-leidas.service";

@Module({
    // Usuarios se registra aquí solo para leer las cuentas activas de un rol:
    // AutenticacionModule no expone ese acceso y notificaciones nunca escribe en ellas.
    imports: [TypeOrmModule.forFeature([TypeOrmNotificacionEntity, TypeOrmUsuarioEntity])],
    controllers: [NotificacionesController],
    providers: [
        CrearNotificacionesService,
        ListarNotificacionesService,
        ContarNoLeidasService,
        MarcarNotificacionLeidaService,
        MarcarTodasLeidasService,
        {
            provide: NOTIFICACION_REPOSITORY,
            useClass: TypeOrmNotificacionRepository,
        },
        {
            provide: CONSULTA_USUARIOS,
            useClass: TypeOrmConsultaUsuariosAdapter,
        },
    ],
    // Los demás módulos notifican por este servicio (RF-02.5)
    exports: [CrearNotificacionesService],
})
export class NotificacionesModule {}
