import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { IObtenerSolicitudPorIdUseCase, SolicitudVista } from "../../domain/ports/in/consultar-solicitudes.port";
import { LECTURA_SOLICITUDES, type ILecturaSolicitudes } from "../../domain/ports/out/lectura-solicitudes.port";

@Injectable()
export class ObtenerSolicitudPorIdService implements IObtenerSolicitudPorIdUseCase {
    constructor(
        @Inject(LECTURA_SOLICITUDES)
        private readonly lecturaSolicitudes: ILecturaSolicitudes,
    ) {}

    async ejecutar(id: string): Promise<SolicitudVista> {
        const resultado = await this.lecturaSolicitudes.obtener(id);

        if (!resultado) {
            throw new NotFoundException(`La solicitud con ID ${id} no fue encontrada.`);
        }

        return Object.assign(resultado.solicitud, { productorNombre: resultado.productorNombre });
    }
}
