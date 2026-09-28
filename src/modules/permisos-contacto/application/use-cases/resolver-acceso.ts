import { ForbiddenException, NotFoundException } from "@nestjs/common";
import type { IConsultaSolicitudes } from "../../domain/ports/out/consulta-solicitudes.port";
import type { IConsultaAgronomos } from "../../domain/ports/out/consulta-agronomos.port";
import type { Actor } from "../../domain/ports/in/gestionar-permisos-contacto.port";
import type { ContextoSolicitud } from "../../domain/entities/permiso-contacto.entity";

export interface AccesoResuelto {
    contexto: ContextoSolicitud;
    // Agrónomo del actor; null cuando quien consulta es el administrador
    agronomoId: string | null;
}

// La solicitud debe existir antes de tocar su permiso
export async function obtenerContexto(
    solicitudId: string,
    consultaSolicitudes: IConsultaSolicitudes,
): Promise<ContextoSolicitud> {
    const contexto = await consultaSolicitudes.obtenerContexto(solicitudId);

    if (!contexto) {
        throw new NotFoundException(`La solicitud con ID ${solicitudId} no fue encontrada.`);
    }

    return contexto;
}

// Control de acceso de las consultas: el administrador ve cualquier solicitud,
// el agrónomo solo las que tiene asignadas y el productor no participa.
export async function resolverAcceso(
    actor: Actor,
    solicitudId: string,
    consultaSolicitudes: IConsultaSolicitudes,
    consultaAgronomos: IConsultaAgronomos,
): Promise<AccesoResuelto> {
    const contexto = await obtenerContexto(solicitudId, consultaSolicitudes);

    if (actor.rol === "admin") {
        return { contexto, agronomoId: null };
    }

    if (actor.rol === "agronomo") {
        const agronomoId = await consultaAgronomos.obtenerAgronomoIdPorUsuario(actor.usuarioId);

        if (!agronomoId || contexto.agronomoId !== agronomoId) {
            throw new ForbiddenException("No tienes acceso a esta solicitud.");
        }

        return { contexto, agronomoId };
    }

    throw new ForbiddenException("No tienes acceso a esta solicitud.");
}
