import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { Request } from "express";
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
            passReqToCallback: true,
        });
    }

    async validate(req: Request, payload: JwtPayload): Promise<UsuarioAutenticado> {
        if (!payload.sub || !payload.jti) {
            throw new UnauthorizedException("Token no válido o sin identificador de usuario");
        }

        // La firma del token no basta: la sesión debe seguir abierta y con actividad reciente (RNF-02.2)
        // El panel marca con X-Sondeo las consultas automáticas hechas sin actividad del usuario. La cabecera
        // solo puede restar actividad, nunca alargar la sesión: falsificarla no da ninguna ventaja.
        await this.sesionesService.verificar(payload.jti, { esSondeo: req.headers["x-sondeo"] === "1" });

        return {
            id: payload.sub,
            telefono: payload.telefono,
            rol: payload.rol,
            sesionId: payload.jti,
        };
    }
}
