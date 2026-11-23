import type {
    ArchivoVuelo,
    ConsultaArchivos,
    ConsultaVuelos,
    Pagina,
    PuntoTraza,
    ResumenVuelo,
    Vuelo,
} from "../../entities/vuelo";
export const VUELOS_REPOSITORY = "VUELOS_REPOSITORY";
export interface IVuelosRepository {
    crearAuditado(vuelo: Vuelo): Promise<void>;
    obtener(id: string): Promise<Vuelo | null>;
    listar(consulta: ConsultaVuelos): Promise<Pagina<Vuelo>>;
    actualizar(id: string, cambios: Partial<Pick<Vuelo, "nombre" | "lote" | "notas">>): Promise<void>;
    // La eliminación y la auditoría se confirman en la misma transacción.
    eliminarAuditado(id: string, actor: string): Promise<boolean>;
    // Bloquea el vuelo y resuelve UNIQUE(vuelo_id, sha256), incluso con subidas concurrentes.
    guardarArchivo(archivo: ArchivoVuelo): Promise<{ archivo: ArchivoVuelo; duplicado: boolean }>;
    archivo(id: string, vueloId?: string): Promise<ArchivoVuelo | null>;
    listarArchivos(vueloId: string, consulta: ConsultaArchivos): Promise<Pagina<ArchivoVuelo>>;
    resumen(ids: string[]): Promise<Record<string, ResumenVuelo>>;
    puntos(vueloId: string): Promise<PuntoTraza[]>;
}
