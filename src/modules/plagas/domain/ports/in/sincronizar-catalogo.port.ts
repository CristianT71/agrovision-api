// Contrato de CatalogSync.kt. Los opcionales se omiten cuando no hay información.
export interface RecommendationDto {
    kind: string;
    summary: string;
    detail: string;
    activeIngredient?: string;
    dosage?: string;
    preHarvestIntervalDays?: number;
}

export interface ApprovalDto {
    agronomistName: string;
    licenseNumber: string;
    approvedAt: number;
}

export interface PestDto {
    id: string;
    scientificName: string;
    commonName: string;
    localSynonyms: string[];
    crop: string;
    affectedOrgans: string[];
    description: string;
    recommendations: RecommendationDto[];
    images: string[];
    version: number;
    kind: string;
    reference?: string;
    approval?: ApprovalDto;
}

export interface CatalogDeltaDto {
    upserted: PestDto[];
    deletedIds: string[];
    etag: string;
    serverTime: number;
}

export interface ISincronizarCatalogoUseCase {
    ejecutar(since?: number): Promise<CatalogDeltaDto>;
}
