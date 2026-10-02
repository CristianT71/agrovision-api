import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ThrottlerModule } from "@nestjs/throttler";
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

@Module({
    imports: [
        ConfigModule.forRoot(),
        // Límite de peticiones por IP para las rutas públicas (OTP y registro). Solo se aplica
        // donde se usa ThrottlerGuard; cada ruta ajusta su límite con @Throttle.
        ThrottlerModule.forRoot({
            throttlers: [{ name: "publico", ttl: 60_000, limit: 10 }],
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
    ],
    controllers: [],
    providers: [],
})
export class AppModule {}
