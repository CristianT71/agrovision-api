import type { EstadoRegla, ReglaZona } from "../../entities/regla-zona";

export const REGLAS_ZONA_REPOSITORY = "REGLAS_ZONA_REPOSITORY";

export interface FiltrosReglasZona {
    tipo?: string;
    estado?: EstadoRegla;
}

// Lecturas fuera de transacción. Cabecera y filas salen de una misma instantánea.
export interface IReglasZonaRepository {
    obtener(id: string): Promise<ReglaZona | null>;
    listar(filtros: FiltrosReglasZona): Promise<ReglaZona[]>;
    obtenerActiva(tipoEnfermedad: string): Promise<ReglaZona | null>;
}

// Escrituras: solo existen dentro de una unidad de trabajo (ver unidad-trabajo.port.ts),
// así el cambio y su auditoría se confirman o se revierten juntos.
export interface IReglasZonaEscritura {
    obtener(id: string): Promise<ReglaZona | null>;
    // Bloquea la regla hasta el fin de la transacción y la lee después del bloqueo:
    // lo leído es exactamente lo que se va a modificar.
    obtenerParaModificar(id: string): Promise<ReglaZona | null>;
    // Calcula la siguiente versión del tipo y guarda la regla.
    // `construir` recibe la versión asignada y devuelve la regla a insertar.
    insertarNuevaVersion(tipoEnfermedad: string, construir: (version: number) => ReglaZona): Promise<ReglaZona>;
    // Solo actualiza si la regla sigue en borrador y en la revisión que el cliente vio; false si no.
    // Las filas solo se reescriben cuando el cambio las incluye.
    guardarBorrador(regla: ReglaZona, revisionVista: number, cambiaFilas: boolean): Promise<boolean>;
    eliminarBorrador(id: string): Promise<boolean>;
    // Persiste la aprobación solo si la regla seguía en borrador y en la revisión revisada.
    guardarAprobacion(regla: ReglaZona, revisionVista: number): Promise<boolean>;
    // Archiva la activa previa del mismo tipo y activa esta (debe seguir aprobada).
    // Devuelve el id de la regla archivada, si había una.
    activar(regla: ReglaZona): Promise<{ archivadaId: string | null }>;
    // Archiva solo si el estado no cambió desde que se leyó.
    archivar(regla: ReglaZona, estadoPrevio: EstadoRegla): Promise<boolean>;
}
