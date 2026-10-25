import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { PreferenciasCorreoService } from "./application/use-cases/preferencias-correo.service";
import { PREFERENCIAS_CORREO } from "./domain/ports/out/preferencias-correo.port";
import { ENVIADOR_CORREO } from "./domain/ports/out/enviador-correo.port";
import { TypeOrmPreferenciasCorreoAdapter } from "./infrastructure/adapters/out/persistence/typeorm-preferencias-correo.adapter";
import { elegirProveedorCorreo } from "./infrastructure/adapters/out/correo/proveedor-correo";
import { SmtpCorreoAdapter } from "./infrastructure/adapters/out/correo/smtp-correo.adapter";
import { LoggerCorreoAdapter } from "./infrastructure/adapters/out/correo/logger-correo.adapter";
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
    imports: [ConfigModule, TypeOrmModule.forFeature([TypeOrmNotificacionEntity, TypeOrmUsuarioEntity])],
    controllers: [NotificacionesController],
    providers: [
        CrearNotificacionesService,
        ListarNotificacionesService,
        ContarNoLeidasService,
        MarcarNotificacionLeidaService,
        MarcarTodasLeidasService,
        PreferenciasCorreoService,
        {
            provide: PREFERENCIAS_CORREO,
            useClass: TypeOrmPreferenciasCorreoAdapter,
        },
        {
            provide: ENVIADOR_CORREO,
            inject: [ConfigService],
            // MAIL_PROVIDER=log deja el correo en la consola; smtp lo envía (Gmail con contraseña de aplicación)
            useFactory: (config: ConfigService) => {
                const proveedor = elegirProveedorCorreo({
                    proveedor: config.get<string>("MAIL_PROVIDER"),
                    usuario: config.get<string>("MAIL_USER"),
                    clave: config.get<string>("MAIL_PASSWORD"),
                });
                return proveedor === "smtp" ? new SmtpCorreoAdapter(config) : new LoggerCorreoAdapter();
            },
        },
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
