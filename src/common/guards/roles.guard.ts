import { Injectable, ForbiddenException } from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { ROLES_KEY } from "../decorators/roles.decorator";
import type { UsuarioAutenticado } from "../decorators/usuario-actual.decorator";

interface RequestConUsuario extends Request {
    user?: UsuarioAutenticado;
}

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        const rolesRequeridos = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (!rolesRequeridos || rolesRequeridos.length === 0) {
            return true;
        }

        const request = context.switchToHttp().getRequest<RequestConUsuario>();
        const usuario = request.user;

        if (!usuario?.rol) {
            throw new ForbiddenException("No cuentas con permisos para esta acción.");
        }

        const tieneRol = rolesRequeridos.includes(usuario.rol);

        if (!tieneRol) {
            throw new ForbiddenException(
                `Acceso denegado. Se requiere uno de los siguientes roles: ${rolesRequeridos.join(", ")}`,
            );
        }

        return true;
    }
}
