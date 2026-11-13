import type { ArchivoRecibido, ConsultaArchivos, ConsultaVuelos, Vuelo } from "../../entities/vuelo";
export const GESTION_VUELOS = "GESTION_VUELOS";
export interface IGestionVuelos {
    crear(actor: string, datos: Pick<Vuelo, "nombre" | "lote" | "notas">): Promise<unknown>;
    listar(consulta: ConsultaVuelos): Promise<unknown>;
    obtener(id: string): Promise<unknown>;
    actualizar(id: string, datos: Partial<Pick<Vuelo, "nombre" | "lote" | "notas">>): Promise<unknown>;
    eliminar(id: string, actor: string): Promise<void>;
    exigirVuelo(id: string): Promise<void>;
    subir(id: string, recibido: ArchivoRecibido): Promise<{ archivo: unknown; duplicado: boolean }>;
    listarArchivos(id: string, consulta: ConsultaArchivos): Promise<unknown>;
    obtenerArchivo(id: string, archivoId: string): Promise<unknown>;
    enlace(id: string, archivoId: string, actor: string): Promise<unknown>;
    traza(id: string): Promise<unknown>;
}
