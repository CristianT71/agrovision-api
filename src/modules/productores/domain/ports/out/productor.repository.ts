import { Productor, EstadoProductor } from "../../entities/productor.entity";

export interface FiltrosProductor {
    estado?: EstadoProductor;
    consentimiento?: boolean;
    municipio?: string;
    busqueda?: string; // Texto libre sobre nombre o finca (RF-03.5)
}

export interface IProductorRepository {
    findById(id: string): Promise<Productor | null>;
    findByUsuarioId(usuarioId: string): Promise<Productor | null>;
    findByTelefono(telefono: string): Promise<Productor | null>;
    findAll(filtros?: FiltrosProductor): Promise<Productor[]>;
    guardar(productor: Productor): Promise<Productor>;
}

// Token de inyección PARA dependencias de NestJS
export const PRODUCTOR_REPOSITORY = "PRODUCTOR_REPOSITORY";
