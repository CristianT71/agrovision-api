import { ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { InjectThrottlerOptions, InjectThrottlerStorage, ThrottlerGuard } from "@nestjs/throttler";
import type { ThrottlerModuleOptions, ThrottlerStorage } from "@nestjs/throttler";
import { THROTTLER_LIMIT } from "@nestjs/throttler/dist/throttler.constants";

// Nombres de los dos límites: "publico" (rutas sin sesión, por IP) y "usuario" (rutas con sesión,
// por cuenta). Cada ruta cae en uno solo: las públicas declaran @Throttle({ publico: ... }).
export const THROTTLER_PUBLICO = "publico";
export const THROTTLER_USUARIO = "usuario";

export function esRutaPublica(contexto: ExecutionContext): boolean {
    const clave = THROTTLER_LIMIT + THROTTLER_PUBLICO;

    return (
        Reflect.getMetadata(clave, contexto.getHandler()) !== undefined ||
        Reflect.getMetadata(clave, contexto.getClass()) !== undefined
    );
}

// Guard global. Corre antes que JwtAuthGuard, así que todavía no hay req.user: para contar por cuenta
// verifica la firma del token aquí. Un token inválido o ausente cuenta por IP, de modo que nadie
// puede esquivar el límite inventando identidades.
@Injectable()
export class ThrottlerPorUsuarioGuard extends ThrottlerGuard {
    constructor(
        @InjectThrottlerOptions() options: ThrottlerModuleOptions,
        @InjectThrottlerStorage() storageService: ThrottlerStorage,
        reflector: Reflector,
        private readonly jwtService: JwtService,
    ) {
        super(options, storageService, reflector);
    }

    protected async getTracker(req: Record<string, any>): Promise<string> {
        const cabeceras = req.headers as Record<string, unknown> | undefined;
        const autorizacion = cabeceras?.authorization;

        if (typeof autorizacion === "string" && autorizacion.startsWith("Bearer ")) {
            try {
                const payload = await this.jwtService.verifyAsync<{ sub?: string }>(autorizacion.slice(7));
                if (payload.sub) return `usuario:${payload.sub}`;
            } catch {
                // Token inválido o vencido: JwtAuthGuard lo rechazará; aquí cuenta por IP
            }
        }

        return `ip:${await super.getTracker(req)}`;
    }
}
