import { Plaga, TipoPlaga } from "../../entities/plaga.entity";

export interface FiltrosPlaga {
    tipo?: TipoPlaga;
    busqueda?: string; // Texto libre sobre nombre común, nombre científico y sinónimos (RF-05.2)
    conAval?: boolean;
}

export interface IPlagaRepository {
    findById(id: string): Promise<Plaga | null>;
    findAll(filtros?: FiltrosPlaga): Promise<Plaga[]>;
    existeNombreCientifico(nombre: string, excluirId?: string): Promise<boolean>;
    guardar(plaga: Plaga): Promise<Plaga>;
}

// Token de inyección PARA dependencias de NestJS
export const PLAGA_REPOSITORY = "PLAGA_REPOSITORY";
