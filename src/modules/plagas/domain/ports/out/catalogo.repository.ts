// Proyección de lectura sin usuarios, correos, teléfonos ni estados administrativos.
export interface FichaCatalogo {
    catalogId: string;
    nombreCientifico: string | null;
    nombreComun: string;
    sinonimos: string[];
    cultivo: string;
    organosAfectados: string[];
    descripcion: string;
    medidasContencion: string;
    protocoloQuimico: string | null;
    fotoUrl: string | null;
    version: number;
    tipo: string;
    aval?: { nombreAgronomo: string; numeroTarjeta: string; fechaAval: Date };
}

export interface ICatalogoRepository {
    leerDelta(since?: number): Promise<{ fichas: FichaCatalogo[]; deletedIds: string[]; serverTime: number }>;
}

export const CATALOGO_REPOSITORY = "CATALOGO_REPOSITORY";
