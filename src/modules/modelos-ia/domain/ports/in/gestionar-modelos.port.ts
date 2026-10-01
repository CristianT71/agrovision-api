import type { ArchivoSubido } from "../../../../../common/almacenamiento/validar-archivo";
import type { Canal, FormatoModelo } from "../../entities/modelo-ia.entity";

// Lo que ve el panel: las rutas internas de los archivos nunca salen de la API
export interface ModeloVista {
    id: string;
    version: string;
    formato: FormatoModelo;
    canal: Canal;
    activo: boolean;
    versionMinApp: string;
    notas: string | null;
    tamanoBytes: number;
    sha256: string;
    firmado: boolean;
    numeroClases: number | null;
    creadoPor: string;
    fechaCreacion: Date;
    fechaPublicacion: Date | null;
    porcentajeCanario: number | null;
    killSwitch: boolean;
    motivoKillSwitch: string | null;
    fechaKillSwitch: Date | null;
}

export interface SubirModeloCommand {
    adminUsuarioId: string;
    version: string;
    versionMinApp: string;
    notas?: string;
    modelo: ArchivoSubido;
    etiquetas?: ArchivoSubido;
    calibracion?: ArchivoSubido;
}

export interface ISubirModeloUseCase {
    ejecutar(comando: SubirModeloCommand): Promise<ModeloVista>;
}

export interface IListarModelosUseCase {
    ejecutar(filtros: { canal?: Canal }): Promise<ModeloVista[]>;
}

export interface IObtenerModeloUseCase {
    ejecutar(id: string): Promise<ModeloVista>;
}
