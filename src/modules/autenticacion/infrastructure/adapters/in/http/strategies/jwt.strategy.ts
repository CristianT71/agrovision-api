import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { SesionesService } from "../../../../../application/use-cases/sesiones.service";
import type { UsuarioAutenticado } from "../../../../../../../common/decorators/usuario-actual.decorator";

export interface JwtPayload {
    sub: string;
    telefono: string;
    rol: string;
    jti?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        configService: ConfigService,
        private readonly sesionesService: SesionesService,
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: configService.getOrThrow<string>("JWT_SECRET"),
        });
    }

    async validate(payload: JwtPayload): Promise<UsuarioAutenticado> {
        if (!payload.sub || !payload.jti) {
            throw new UnauthorizedException("Token no válido o sin identificador de usuario");
        }

        // La firma del token no basta: la sesión debe seguir abierta y con actividad reciente (RNF-02.2)
        await this.sesionesService.verificar(payload.jti);

        return {
            id: payload.sub,
            telefono: payload.telefono,
            rol: payload.rol,
            sesionId: payload.jti,
        };
    }
}
