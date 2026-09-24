import type { Productor } from "../../entities/productor.entity";
import type { FiltrosProductor } from "../out/productor.repository";

// Identifica al productor: por id (administrador) o por su cuenta (el propio productor)
export type CriterioProductor = { id: string } | { usuarioId: string };

export interface CompletarPerfilProductorCommand {
    // Del token: el productor ya se registró por OTP desde la app móvil
    usuarioId: string;
    telefono: string;
    nombre: string;
    finca: string;
    vereda: string;
    municipio: string;
    consentimiento: boolean;
}

export interface ICompletarPerfilProductorUseCase {
    ejecutar(comando: CompletarPerfilProductorCommand): Promise<Productor>;
}

export interface IListarProductoresUseCase {
    ejecutar(filtros: FiltrosProductor): Promise<Productor[]>;
}

export interface IObtenerProductorUseCase {
    ejecutar(criterio: CriterioProductor): Promise<Productor>;
}

export interface IValidarProductorUseCase {
    ejecutar(productorId: string): Promise<Productor>;
}

// RF-10.2 / RF-10.3: otorgar o revocar el consentimiento de uso de fotos
export interface IConsentimientoProductorUseCase {
    otorgar(criterio: CriterioProductor): Promise<Productor>;
    revocar(criterio: CriterioProductor, confirmacion: boolean): Promise<Productor>;
}
