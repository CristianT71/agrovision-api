// Quien consulta o cambia el permiso, tal como llega del token (usuarios.id + rol)
export interface Actor {
    usuarioId: string;
    rol: string;
}

// Estado del permiso que ve el panel. "habilitado" ya considera al agrónomo asignado hoy:
// un permiso otorgado a un evaluador anterior se muestra como no habilitado.
export interface PermisoContactoVista {
    solicitudId: string;
    habilitado: boolean;
    agronomoId: string | null;
    otorgadoPor: string | null;
    fechaOtorgado: Date | null;
    revocadoPor: string | null;
    fechaRevocado: Date | null;
}

// RF-04.10: teléfono del productor del caso
export interface ContactoProductorVista {
    solicitudId: string;
    productorNombre: string;
    telefono: string;
}

export interface IObtenerPermisoContactoUseCase {
    ejecutar(consulta: { actor: Actor; solicitudId: string }): Promise<PermisoContactoVista>;
}

export interface IOtorgarPermisoContactoUseCase {
    ejecutar(comando: { adminUsuarioId: string; solicitudId: string }): Promise<PermisoContactoVista>;
}

export interface IRevocarPermisoContactoUseCase {
    ejecutar(comando: { adminUsuarioId: string; solicitudId: string }): Promise<PermisoContactoVista>;
}

export interface IObtenerContactoProductorUseCase {
    ejecutar(consulta: { actor: Actor; solicitudId: string }): Promise<ContactoProductorVista>;
}
