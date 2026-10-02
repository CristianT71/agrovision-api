import type { PermisoContacto } from "../../entities/permiso-contacto.entity";

export interface IPermisoContactoRepository {
    findBySolicitudId(solicitudId: string): Promise<PermisoContacto | null>;
    // Inserta o actualiza la fila de la solicitud (una por caso) y devuelve la que quedó guardada
    guardar(permiso: PermisoContacto): Promise<PermisoContacto>;
}

// Token de inyección PARA dependencias de NestJS
export const PERMISO_CONTACTO_REPOSITORY = "PERMISO_CONTACTO_REPOSITORY";
