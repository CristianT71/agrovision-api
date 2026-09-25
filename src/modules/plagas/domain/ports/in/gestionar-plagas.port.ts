import type { Plaga, TipoPlaga } from "../../entities/plaga.entity";
import type { FiltrosPlaga } from "../out/plaga.repository";
import type { ArchivoParaGuardar } from "../../../../../common/almacenamiento/almacenamiento.port";

// Datos de la ficha botánica (RF-05.4). El protocolo químico y los avales tienen su propio flujo.
export interface DatosFichaPlaga {
    nombreComun: string;
    nombreCientifico?: string | null;
    tipo: TipoPlaga;
    descripcion: string;
    sintomas: string;
    cultivo?: string;
    organosAfectados: string[];
    hospederos?: string[];
    medidasContencion: string;
    sinonimos?: string[];
}

export interface IListarPlagasUseCase {
    ejecutar(filtros: FiltrosPlaga): Promise<Plaga[]>;
}

export interface IObtenerPlagaUseCase {
    ejecutar(id: string): Promise<Plaga>;
}

export interface ICrearPlagaUseCase {
    ejecutar(datos: DatosFichaPlaga): Promise<Plaga>;
}

export interface IActualizarPlagaUseCase {
    ejecutar(id: string, cambios: Partial<DatosFichaPlaga>): Promise<Plaga>;
}

export interface IAvalarPlagaUseCase {
    // El agrónomo firmante sale del token (usuarioId), nunca del cuerpo de la petición
    ejecutar(comando: { plagaId: string; usuarioId: string }): Promise<Plaga>;
}

export interface IActualizarProtocoloQuimicoUseCase {
    ejecutar(comando: { plagaId: string; protocoloQuimico: string }): Promise<Plaga>;
}

export interface ISubirFotoPlagaUseCase {
    ejecutar(comando: { plagaId: string; archivo: ArchivoParaGuardar }): Promise<Plaga>;
}
