import { createParamDecorator } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

export interface UsuarioAutenticado {
    id: string;
    telefono: string;
    rol: string;
}

interface RequestConUsuario extends Request {
    user?: UsuarioAutenticado;
}

export const UsuarioActual = createParamDecorator(
    (data: keyof UsuarioAutenticado | undefined, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest<RequestConUsuario>();
        const usuario = request.user;

        return data && usuario ? usuario[data] : usuario;
    },
);
