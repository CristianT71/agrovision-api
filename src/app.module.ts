import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SolicitudesModule } from "./modules/solicitudes/solicitudes.module";

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
            synchronize: false,
        }),
        SolicitudesModule,
    ],
    controllers: [],
    providers: [],
})
export class AppModule {}
