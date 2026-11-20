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
    // Alta del perfil (o reescritura completa). Para cambios de estado o consentimiento usar los
    // métodos de abajo: tocan solo su campo y fallan si otra operación lo cambió entretanto.
    guardar(productor: Productor): Promise<Productor>;
    // Persiste consentimiento y fecha solo si en la base sigue el valor contrario. false = conflicto.
    guardarConsentimiento(productor: Productor): Promise<boolean>;
    // Pasa de "registrado" a "validado" sin tocar el resto del perfil. false = conflicto.
    guardarValidacion(productor: Productor): Promise<boolean>;
}

// Token de inyección PARA dependencias de NestJS
export const PRODUCTOR_REPOSITORY = "PRODUCTOR_REPOSITORY";
