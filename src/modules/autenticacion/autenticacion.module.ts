import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";

import { TypeOrmUsuarioEntity } from "./infrastructure/adapters/out/persistence/typeorm-usuario.entity";
import { TypeOrmSesionOtpEntity } from "./infrastructure/adapters/out/persistence/typeorm-sesion-otp.entity";
import { TypeOrmUsuarioRepository } from "./infrastructure/adapters/out/persistence/typeorm-usuario.repository";
import { TypeOrmSesionOtpRepository } from "./infrastructure/adapters/out/persistence/typeorm-sesion-otp.repository";
import { TypeOrmSesionUsuarioEntity } from "./infrastructure/adapters/out/persistence/typeorm-sesion-usuario.entity";
import { TypeOrmSesionUsuarioRepository } from "./infrastructure/adapters/out/persistence/typeorm-sesion-usuario.repository";
//import { ZavuSmsAdapter } from "./infrastructure/adapters/out/sms/zavu-sms.adapter";
import { LoggerSmsAdapter } from "./infrastructure/adapters/out/sms/logger-sms.adapter";
import { AuthController } from "./infrastructure/adapters/in/http/auth.controller";
import { JwtStrategy } from "./infrastructure/adapters/in/http/strategies/jwt.strategy";
import { USUARIO_REPOSITORY } from "./domain/ports/out/usuario.repository";
import { SESION_OTP_REPOSITORY } from "./domain/ports/out/sesion-otp.repository";
import { SESION_USUARIO_REPOSITORY } from "./domain/ports/out/sesion-usuario.repository";
import { SMS_SERVICE } from "./domain/ports/out/sms.service";

import { SolicitarOtpService } from "./application/use-cases/solicitar-otp.service";
import { ValidarOtpService } from "./application/use-cases/validar-otp.service";
import { SesionesService } from "./application/use-cases/sesiones.service";
import { AgronomosModule } from "../agronomos/agronomos.module";

@Module({
    imports: [
        ConfigModule,
        PassportModule.register({ defaultStrategy: "jwt" }),
        TypeOrmModule.forFeature([TypeOrmUsuarioEntity, TypeOrmSesionOtpEntity, TypeOrmSesionUsuarioEntity]),
        // El login consulta el estado del agrónomo (RF-10.5)
        AgronomosModule,
        JwtModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
                // Sin valor por defecto: firmar con un secreto conocido permitiría falsificar tokens
                secret: configService.getOrThrow<string>("JWT_SECRET"),
                // La duración del token depende del rol y la fija cada sesión (ver SesionUsuario)
            }),
        }),
    ],
    controllers: [AuthController],
    providers: [
        SolicitarOtpService,
        ValidarOtpService,
        SesionesService,
        JwtStrategy,
        {
            provide: USUARIO_REPOSITORY,
            useClass: TypeOrmUsuarioRepository,
        },
        {
            provide: SESION_OTP_REPOSITORY,
            useClass: TypeOrmSesionOtpRepository,
        },
        {
            provide: SESION_USUARIO_REPOSITORY,
            useClass: TypeOrmSesionUsuarioRepository,
        },
        {
            provide: SMS_SERVICE,
            useClass: LoggerSmsAdapter,
        },
    ],
    exports: [SolicitarOtpService, ValidarOtpService, JwtModule, PassportModule],
})
export class AutenticacionModule {}
