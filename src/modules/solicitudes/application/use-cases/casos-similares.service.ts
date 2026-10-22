import { Inject, Injectable } from "@nestjs/common";
import { LECTURA_SOLICITUDES, type ILecturaSolicitudes } from "../../domain/ports/out/lectura-solicitudes.port";
import { calcularSimilitud } from "../../domain/services/similitud-casos";
import { VerificarAccesoSolicitudService } from "./verificar-acceso-solicitud.service";

// Cuántos casos resueltos recientes se comparan como máximo: suficiente para una bandeja real
// sin cargar toda la historia en memoria
const MAX_CANDIDATOS = 500;

export interface CasoSimilar {
    id: string;
    // Datos del productor de OTRO expediente: solo los recibe el administrador
    productorNombre?: string | null;
    municipio?: string;
    vereda?: string;
    finca?: string;
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
        private readonly verificarAcceso: VerificarAccesoSolicitudService,
    ) {}

    async ejecutar(usuario: { id: string; rol: string }, solicitudId: string, limite = 3): Promise<CasoSimilar[]> {
        // La verificación ya trae el caso base: no se vuelve a consultar
        const acceso = await this.verificarAcceso.ejecutar(usuario, solicitudId);
        const esAgronomo = acceso.agronomoId !== null;

        const candidatos = await this.lecturaSolicitudes.listarResueltas(solicitudId, MAX_CANDIDATOS);

        return candidatos
            .map(({ solicitud, productorNombre }) => {
                const caso: CasoSimilar = {
                    id: solicitud.id,
                    plagaIdentificada: solicitud.plagaIdentificada,
                    tipoResultado: solicitud.tipoResultado,
                    fechaResolucion: solicitud.fechaResolucion,
                    similitud: calcularSimilitud(acceso.solicitud, solicitud),
                };

                // Son expedientes de otros productores: el agrónomo solo recibe el antecedente técnico
                if (esAgronomo) return caso;

                return {
                    ...caso,
                    productorNombre,
                    municipio: solicitud.municipio,
                    vereda: solicitud.vereda,
                    finca: solicitud.finca,
                };
            })
            .sort((a, b) => b.similitud - a.similitud)
            .slice(0, limite);
    }
}
