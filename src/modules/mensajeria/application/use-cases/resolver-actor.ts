import { ForbiddenException, NotFoundException } from "@nestjs/common";
import type { IConsultaSolicitudes } from "../../domain/ports/out/consulta-solicitudes.port";
import type { IConsultaAgronomos } from "../../domain/ports/out/consulta-agronomos.port";
import type { Actor } from "../../domain/ports/in/gestionar-mensajes.port";
import type { AutorTipo } from "../../domain/entities/mensaje.entity";
import type { ContextoSolicitud } from "../../domain/services/canal-coordinacion";

export interface ActorResuelto {
    contexto: ContextoSolicitud;
    autorTipo: AutorTipo;
}

// Control de acceso del canal interno, compartido por todos los casos de uso:
// el administrador coordina cualquier solicitud, el agrónomo solo las suyas y
// el productor no participa (el canal es interno).
export async function resolverActor(
    actor: Actor,
    solicitudId: string,
    consultaSolicitudes: IConsultaSolicitudes,
    consultaAgronomos: IConsultaAgronomos,
): Promise<ActorResuelto> {
    const contexto = await consultaSolicitudes.obtenerContexto(solicitudId);

    if (!contexto) {
        throw new NotFoundException(`La solicitud con ID ${solicitudId} no fue encontrada.`);
    }

    if (actor.rol === "admin") {
        return { contexto, autorTipo: "admin" };
    }

    if (actor.rol === "agronomo") {
        const agronomoId = await consultaAgronomos.obtenerAgronomoIdPorUsuario(actor.usuarioId);

        if (!agronomoId || contexto.agronomoId !== agronomoId) {
            throw new ForbiddenException("No tienes acceso al canal de esta solicitud.");
        }

        return { contexto, autorTipo: "agronomo" };
    }

    throw new ForbiddenException("No tienes acceso al canal de esta solicitud.");
}
