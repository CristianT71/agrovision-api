import type { PermisoContacto, ContextoSolicitud } from "../../domain/entities/permiso-contacto.entity";
import type { PermisoContactoVista } from "../../domain/ports/in/gestionar-permisos-contacto.port";

// "habilitado" se calcula contra el agrónomo asignado hoy, no contra la columna:
// así el panel no muestra como vigente un permiso de un evaluador anterior.
// Sin permiso registrado la solicitud se muestra como nunca otorgada.
export function aPermisoContactoVista(
    permiso: PermisoContacto | null,
    contexto: ContextoSolicitud,
): PermisoContactoVista {
    return {
        solicitudId: contexto.id,
        habilitado: permiso?.estaVigentePara(contexto.agronomoId) ?? false,
        agronomoId: permiso?.agronomoId ?? null,
        otorgadoPor: permiso?.otorgadoPor ?? null,
        fechaOtorgado: permiso?.fechaOtorgado ?? null,
        revocadoPor: permiso?.revocadoPor ?? null,
        fechaRevocado: permiso?.fechaRevocado ?? null,
    };
}
