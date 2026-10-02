import type { ArchivoSubido } from "../../../../../common/almacenamiento/validar-archivo";
import type { Canal, FormatoModelo } from "../../entities/modelo-ia.entity";
import type { AccionAuditoria } from "../../entities/registro-auditoria.entity";
import type { AdopcionModelo } from "../out/consulta-adopcion.port";

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
    // RF-09.2: la global (clase null) primero y luego las de cada clase
    metricas: MetricaVista[];
    // RF-09.1: penetración instalada en los últimos días (solo en el inventario)
    adopcion?: AdopcionModelo;
}

// Días hacia atrás con los que se mide la adopción
export const VENTANA_ADOPCION_DIAS = 30;

export interface MetricaVista {
    clase: string | null;
    precision: number;
    recall: number;
    f1: number;
}

export interface RegistrarMetricasCommand {
    adminUsuarioId: string;
    modeloId: string;
    global: { precision: number; recall: number; f1: number };
    porClase?: MetricaVista[];
}

export interface IRegistrarMetricasUseCase {
    ejecutar(comando: RegistrarMetricasCommand): Promise<ModeloVista>;
}

export interface CambiarCanalCommand {
    adminUsuarioId: string;
    modeloId: string;
    canal: Canal;
    porcentajeCanario?: number;
}

export interface ICambiarCanalUseCase {
    // Devuelve el modelo y, si lo hubo, el que dejó de estar en producción
    ejecutar(comando: CambiarCanalCommand): Promise<{ modelo: ModeloVista; retirado: ModeloVista | null }>;
}

export interface ActivarKillSwitchCommand {
    adminUsuarioId: string;
    modeloId: string;
    justificacion: string;
}

export interface IActivarKillSwitchUseCase {
    ejecutar(comando: ActivarKillSwitchCommand): Promise<ModeloVista>;
}

export interface AuditoriaVista {
    id: string;
    accion: AccionAuditoria;
    actorUsuarioId: string;
    motivo: string | null;
    detalle: Record<string, unknown> | null;
    fecha: Date;
}

export interface IListarAuditoriaModeloUseCase {
    ejecutar(modeloId: string): Promise<AuditoriaVista[]>;
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
