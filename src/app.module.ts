import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SolicitudesModule } from "./modules/solicitudes/solicitudes.module";
import { AutenticacionModule } from "./modules/autenticacion/autenticacion.module";
import { AgronomosModule } from "./modules/agronomos/agronomos.module";
import { ProductoresModule } from "./modules/productores/productores.module";
import { PlagasModule } from "./modules/plagas/plagas.module";
import { MensajeriaModule } from "./modules/mensajeria/mensajeria.module";
import { NotificacionesModule } from "./modules/notificaciones/notificaciones.module";

@Module({
    imports: [
        ConfigModule.forRoot(),
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
    ],
    controllers: [],
    providers: [],
})
export class AppModule {}
