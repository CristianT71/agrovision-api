import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { LECTURA_SOLICITUDES, type ILecturaSolicitudes } from "../../domain/ports/out/lectura-solicitudes.port";
import { calcularSimilitud } from "../../domain/services/similitud-casos";

// Cuántos casos resueltos recientes se comparan como máximo: suficiente para una bandeja real
// sin cargar toda la historia en memoria
const MAX_CANDIDATOS = 500;

export interface CasoSimilar {
    id: string;
    productorNombre: string | null;
    municipio: string;
    vereda: string;
    finca: string;
    plagaIdentificada: string | null;
    tipoResultado: string | null;
    fechaResolucion: Date | null;
    // Porcentaje de 0 a 100
    similitud: number;
}

// RF-04.3: expedientes resueltos con mayor correlación con el caso que se revisa
@Injectable()
export class CasosSimilaresService {
    constructor(
        @Inject(LECTURA_SOLICITUDES)
        private readonly lecturaSolicitudes: ILecturaSolicitudes,
    ) {}

    async ejecutar(solicitudId: string, limite = 3): Promise<CasoSimilar[]> {
        const base = await this.lecturaSolicitudes.obtener(solicitudId);
        if (!base) {
            throw new NotFoundException(`La solicitud con ID ${solicitudId} no fue encontrada.`);
        }

        const candidatos = await this.lecturaSolicitudes.listarResueltas(solicitudId, MAX_CANDIDATOS);

        return candidatos
            .map(({ solicitud, productorNombre }) => ({
                id: solicitud.id,
                productorNombre,
                municipio: solicitud.municipio,
                vereda: solicitud.vereda,
                finca: solicitud.finca,
                plagaIdentificada: solicitud.plagaIdentificada,
                tipoResultado: solicitud.tipoResultado,
                fechaResolucion: solicitud.fechaResolucion,
                similitud: calcularSimilitud(base.solicitud, solicitud),
            }))
            .sort((a, b) => b.similitud - a.similitud)
            .slice(0, limite);
    }
}
