import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";

export interface JwtPayload {
    sub: string;
    telefono: string;
    rol: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(configService: ConfigService) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: configService.get<string>("JWT_SECRET", "secreto_agrovision_desarrollo"),
        });
    }

    validate(payload: JwtPayload) {
        if (!payload.sub) {
            throw new UnauthorizedException("Token no válido o sin identificador de usuario");
        }

        return {
            id: payload.sub,
            telefono: payload.telefono,
            rol: payload.rol,
        };
    }
}
