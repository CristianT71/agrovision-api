import type { EstadoRegla, ReglaZona } from "../../entities/regla-zona";

export const REGLAS_ZONA_REPOSITORY = "REGLAS_ZONA_REPOSITORY";

export interface FiltrosReglasZona {
    tipo?: string;
    estado?: EstadoRegla;
}

export interface IReglasZonaRepository {
    obtener(id: string): Promise<ReglaZona | null>;
    listar(filtros: FiltrosReglasZona): Promise<ReglaZona[]>;
    obtenerActiva(tipoEnfermedad: string): Promise<ReglaZona | null>;
    // Calcula la siguiente versión del tipo y guarda la regla en una sola transacción.
    // `construir` recibe la versión asignada y devuelve la regla a insertar.
    insertarNuevaVersion(tipoEnfermedad: string, construir: (version: number) => ReglaZona): Promise<ReglaZona>;
    // Solo actualiza si la regla sigue en borrador; false si otra operación la cambió antes.
    guardarBorrador(regla: ReglaZona): Promise<boolean>;
    eliminarBorrador(id: string): Promise<boolean>;
    // Persiste la aprobación solo si la regla seguía en borrador.
    guardarAprobacion(regla: ReglaZona): Promise<boolean>;
    // En una transacción: archiva la activa previa del mismo tipo y activa esta (debe seguir aprobada).
    // Devuelve el id de la regla archivada, si había una.
    activar(regla: ReglaZona): Promise<{ archivadaId: string | null }>;
    // Archiva solo si el estado no cambió desde que se leyó.
    archivar(regla: ReglaZona, estadoPrevio: EstadoRegla): Promise<boolean>;
}
