import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerModule } from "@nestjs/throttler";
import {
    esRutaPublica,
    THROTTLER_PUBLICO,
    THROTTLER_USUARIO,
    ThrottlerPorUsuarioGuard,
} from "./common/guards/throttler-por-usuario.guard";
import { SolicitudesModule } from "./modules/solicitudes/solicitudes.module";
import { AutenticacionModule } from "./modules/autenticacion/autenticacion.module";
import { AgronomosModule } from "./modules/agronomos/agronomos.module";
import { ProductoresModule } from "./modules/productores/productores.module";
import { PlagasModule } from "./modules/plagas/plagas.module";
import { MensajeriaModule } from "./modules/mensajeria/mensajeria.module";
import { NotificacionesModule } from "./modules/notificaciones/notificaciones.module";
import { PermisosContactoModule } from "./modules/permisos-contacto/permisos-contacto.module";
import { ModelosIaModule } from "./modules/modelos-ia/modelos-ia.module";
import { DeteccionesModule } from "./modules/detecciones/detecciones.module";
import { TelemetriaModule } from "./modules/telemetria/telemetria.module";

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
        }),
        // Límites de peticiones, aplicados a TODAS las rutas por un guard global:
        //  - "publico": rutas sin sesión (OTP, registro, modelos, telemetría), por IP; cada una ajusta su
        //    límite con @Throttle({ publico: ... }), y esa anotación es la que la marca como pública.
        //  - "usuario": el resto, por cuenta (o por IP si no hay token válido); se ajusta con @Throttle({ usuario: ... }).
        ThrottlerModule.forRoot({
            throttlers: [
                { name: THROTTLER_PUBLICO, ttl: 60_000, limit: 10, skipIf: (contexto) => !esRutaPublica(contexto) },
                { name: THROTTLER_USUARIO, ttl: 60_000, limit: 240, skipIf: (contexto) => esRutaPublica(contexto) },
            ],
            errorMessage: "Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.",
        }),
        TypeOrmModule.forRoot({
            type: "postgres",
            host: process.env.DB_HOST,
            port: parseInt(process.env.DB_PORT ?? "5432"),
            username: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            autoLoadEntities: true,
            schema: "public",
            // Las migraciones son la única fuente de verdad del esquema (ver src/database/migrations)
            synchronize: false,
        }),
        SolicitudesModule,
        AutenticacionModule,
        AgronomosModule,
        ProductoresModule,
        PlagasModule,
        MensajeriaModule,
        NotificacionesModule,
        PermisosContactoModule,
        ModelosIaModule,
        DeteccionesModule,
        TelemetriaModule,
    ],
    controllers: [],
    providers: [{ provide: APP_GUARD, useClass: ThrottlerPorUsuarioGuard }],
})
export class AppModule {}
