import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmUsuarioEntity } from "./infrastructure/adapters/out/persistence/typeorm-usuario.entity";
import { TypeOrmSesionOtpEntity } from "./infrastructure/adapters/out/persistence/typeorm-sesion-otp.entity";
import { TypeOrmUsuarioRepository } from "./infrastructure/adapters/out/persistence/typeorm-usuario.repository";
import { TypeOrmSesionOtpRepository } from "./infrastructure/adapters/out/persistence/typeorm-sesion-otp.repository";
import { LoggerSmsAdapter } from "./infrastructure/adapters/out/sms/logger-sms.adapter";
import { USUARIO_REPOSITORY } from "./domain/ports/out/usuario.repository";
import { SESION_OTP_REPOSITORY } from "./domain/ports/out/sesion-otp.repository";
import { SMS_SERVICE } from "./domain/ports/out/sms.service";
import { SolicitarOtpService } from "./application/use-cases/solicitar-otp.service";
import { ValidarOtpService } from "./application/use-cases/validar-otp.service";
import { AuthController } from "./infrastructure/adapters/in/http/auth.controller";

@Module({
    imports: [
        TypeOrmModule.forFeature([TypeOrmUsuarioEntity, TypeOrmSesionOtpEntity]),
        JwtModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
                secret: configService.get<string>("JWT_SECRET", "secreto_agrovision_desarrollo"),
                signOptions: { expiresIn: "12h" },
            }),
        }),
    ],
    controllers: [AuthController],
    providers: [
        SolicitarOtpService,
        ValidarOtpService,
        {
            provide: USUARIO_REPOSITORY,
            useClass: TypeOrmUsuarioRepository,
        },
        {
            provide: SESION_OTP_REPOSITORY,
            useClass: TypeOrmSesionOtpRepository,
        },
        {
            provide: SMS_SERVICE,
            useClass: LoggerSmsAdapter,
        },
    ],
    exports: [SolicitarOtpService, ValidarOtpService, JwtModule],
})
export class AutenticacionModule {}
